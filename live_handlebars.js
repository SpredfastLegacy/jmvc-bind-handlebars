/**
 * (c) 2012 Spredfast, Inc. BSD Licensed; see LICENSE.txt
 */
steal("jquery","can/observe/compute","can","jquery/lang/string","mustache","jquery/view",function($,compute,can) {
	"use strict";
	/*global Handlebars */
	var toString = Object.prototype.toString;

	var _ = {
		filter: function(obj,iterator,context) {
			var results = [];
			this.each(obj,function(value,key) {
				if(iterator.call(context,value,key)) {
					results.push(value);
				}
			});
			return results;
		},
		map: function(obj,iterator,context) {
			return $.map(obj,function(value,key) {
				return iterator.call(context,value,key);
			});
		},
		not: function(fn) {
			return function() {
				return !fn.apply(this,arguments);
			};
		},
		keys: function(obj) {
			return _.map(obj,function(v,key) {
				return key;
			});
		},
		isFunction: function(obj) {
			return toString.call(obj) == '[object Function]';
		},
		isString: function(obj) {
			return toString.call(obj) == '[object String]';
		},
		find: function(obj,iterator) {
			for(var i = 0, l = obj.length; i < l; i++) {
				if(iterator(obj[i])) {
					return obj[i];
				}
			}
		}
	};

	_.each = _.map;

	var TMPL = /\{([^\s\{\}]+)\}/g,
		PREFIX = 'data-live-hookup',
		// XXX jQuery does strange things with data keys, so test how it maps PREFIX
		DATA_KEY = _.keys($('<div '+PREFIX+' />').data())[0],
		hookups = {},
		lists = {},
		id = 0,
		listId = 0;

	// allows multiple hookups per element
	// $.View.hookup will only work for the first hookup on an element, but we may have multiple
	function addHookup(fn) {
		hookups[++id] = fn;
		return new Handlebars.SafeString(
			can.view.hook(runHookups) +
		' '+PREFIX+id);
	}

	function bindings(obj,el,createBinder) {
		/*jshint validthis:true */
		_.map(obj,function(value,key,obj) {
			var binding = createBinder.call(this,value,key,obj),
				compute = binding[0],
				binder = binding[1];
			compute.bind('change',binder);
			el.bind('destroyed',function() {
				compute.unbind('change',binder);
			});
			return binder;
		});
	}

	// takes a simple string that may have substitutions and figures out what
	// attributes it depends on
	function parseEvents(bindTo) {
		var attrs = [];
		if(_.isString(bindTo) && bindTo.match(TMPL)) {
			bindTo.replace(TMPL,function(match,attr) {
				attrs.push(attr);
			});
			return {attrs:attrs};
		} else {
			return bindTo;
		}
	}

	function getValue(obj,attr) {
		var attrs = parseEvents(attr);
		if(attrs.attrs) {
			var results = {};
			_.each(attrs.attrs,function(attr) {
				results[attr] = getValue(obj,attr);
			});
			return results;
		} else if(_.isFunction(obj[attrs])) {
			return obj[attrs]();
		} else if(_.isFunction(attr)) {
			return attr.call(obj);
		} else {
			return obj.attr(attrs);
		}
	}

	// add a binding based on doing substitions on the value for each name="value" pair
	// in the options hash
	// either ctx or this is bound to, depending on who has a bind function
	function bindMany(ctx,options,update) {
		/*jshint validthis:true */
		if(!options) {
			options = ctx;
			ctx = this;
		}
		return addHookup(bindingsSetup(ctx,options.hash,update));
	}

	function bindingsSetup(ctx,options,update) {
		return function(el) {
			bindings.call(ctx,options,el,function(bindTo,key) {
				var length, not, tmpl;
				if( _.isString(bindTo) ) {
					tmpl = bindTo.match(TMPL);
					not = !tmpl && bindTo.charAt(0) === '!';
					bindTo = not ? bindTo.substring(1) : bindTo;
					length = !tmpl && bindTo.charAt(0) === '#';
					bindTo = length ? (bindTo.substring(1) + '.length') : bindTo;
				}
				function simpleUpdate() {
					var foo = length;
					var value = getValue(ctx,bindTo);
					update.call(ctx,el,
						tmpl ? $.String.sub(bindTo,value) :
							not ? !value : value,
						key);
					return value;
				}
				return [compute(simpleUpdate),simpleUpdate];
			});
		};
	}

	// bind to a single attribute change
	function bindOne(attr,options,update) {
		/*jshint validthis:true */
		var ctx = options.hash.context || this;
		return bindMany.call(this,ctx,{hash:{attr:attr}},update);
	}

	// run all the hookups attached to el
	function runHookups(el) {
		/*jshint validthis:true */
		el = $(el);
		_.each(el.data(),function(value,key) {
			var id;
			if(key.indexOf(DATA_KEY) === 0) {
				id = +(key.substring(DATA_KEY.length));
				hookups[id](el);
				delete hookups[id];
				el.removeData(key);
			}
		},this);
	}

	Handlebars.registerHelper('bindAttr',function(ctx,options) {
		return bindMany.call(this,ctx,options,function(el,value,attr) {
			el.attr(attr,""+value);
		});
	});

	Handlebars.registerHelper('bindClass',function(ctx,options) {
		return bindMany.call(this,ctx,options,function(el,condition,className) {
			el.toggleClass(""+className,!!condition);
		});
	});

	Handlebars.registerHelper('bindHtml',function(attr,options) {
		return bindOne.call(this,attr,options,function(el,html) {
			el.html(""+html);
		});
	});

	Handlebars.registerHelper('bindIf',function(attr,options) {
		var ctx = options.hash.context || this,
			templateContext = this,
			oldValue;
		return '<span ' + addHookup(function(el) {
			// XXX put the bindings on a hidden element next to the content.
			// The placeholder will get destroyed along with the content and unbind.
			var placeholderEl = $("<span />").addClass('live-handlebars-placeholder').hide(),
				bind = {_changed:attr},
				content = $(el);
			// XXX jQuery wont do a before on "disconnected" nodes
			content[0].parentNode.insertBefore( placeholderEl[0], content[0] );
			bindingsSetup(ctx,bind,function(placeholderEl,condition) {
				// XXX important, coerce to a boolean. We don't care if it changed
				// from 1 to 2, only the truthyness.
				condition = !!condition;
				// don't re-render if the result hasn't changed
				if ( oldValue === condition ) {
					return;
				}
				oldValue = condition;

				var newContent = $('<div/>').
					html( (condition ? options.fn : options.inverse)(templateContext) ).
					children();

				if(!newContent.length) {
					newContent = $('<span></span>');
				}

				// XXX we're disconnected here too, so have to implement our own replaceWith.
				var contentNode = content[0];
				newContent.each(function() {
					contentNode.parentNode.insertBefore( this, contentNode );
				});
				content.remove();
				content = newContent;
			})(placeholderEl);
		}) +'></span>';
	});

	// class we add ot each item to mark it as part of the bound list
	var LIST_BINDING = 'live-handlebars-list-';
	// data key for the custom item id
	var ITEM_BINDING = 'live-handlebars-list-item-id';
	Handlebars.registerHelper('bindList',function(ctx,options) {
		if(!ctx.bind) {
			options = ctx;
			ctx = this;
		}
		lists[++listId] = {};
		var id = listId, ns = '',
			sort = options.hash.sortBy;
		var sortBy = sort ? _.isFunction(sort) ? sort : function(model) {
			return sort === '.' ? model : model && model.attr && model.attr(sort);
		} : false;
		if(options.hash.namespace) {
			ns = '.' + options.hash.namespace;
		}
		function findBefore(model,el) {
			if(!sortBy) {
				return;
			}
			var value = sortBy(model);
			var before = _.find(el.find('.'+LIST_BINDING+id),function(item) {
				return sortBy(modelStore[$(item).data(ITEM_BINDING)].value) > value;
			});
			return before && $(before);
		}
		var modelStore = {}, modelIds = 0;
		function lookupModel(model,remove) {
			var type = model.constructor,
				idProp = type && type.id,
				id = model.attr && model.attr(idProp),
				eq = id ? function(m) {
					return m instanceof type && m.attr(idProp) === id;
				} : function(m) {
					return m === model;
				}, m;
			_.each(modelStore,function(wrapper) {
				if(eq(wrapper.value)) {
					if(remove) {
						delete modelStore[wrapper.id];
					}
					m = wrapper;
				}
			});
			if(!remove && !m) {
				m = {
					id: modelIds++,
					value: model
				};
				modelStore[m.id] = m;
			}
			return m;
		}
		function elements(model,el,rm) {
			var wrapper = lookupModel(model,rm);
			if(wrapper) {
				return el.find('.'+LIST_BINDING+id).filter(function() {
					return $(this).data(ITEM_BINDING) === wrapper.id;
				});
			}
			return $([]);
		}
		return addHookup(function(el) {
			function add(ev,models,index) {
				if(!lists[id]) {
					return;
				}
				var before;
				var after;
				if(options.hash.unique) {
					// remove duplicates
					remove(ev,models);
				}
				// if there is an element before or after already rendered,
				// render after or before it
				if(ctx[index - 1]) {
					after = elements(ctx[index - 1],el);
				} else if(ctx[index + models.length]) {
					before = elements(ctx[index + models.length],el);
				}
				_.each(models,function(model,i) {
					var config = {
						appendTo: el,
						after: after,
						before: findBefore(model,el) || before,
						item: $(can.view.frag(lists[id].tmpl(model))).children()
					};
					el.trigger('beforeAdd'+ns,config);
					if(config.before && config.before.length) {
						config.before.before( config.item );
					} else if(config.after && config.after.length) {
						config.after.after( config.item );
						// XXX following items should come after this one
						after = config.item;
					} else {
						config.appendTo.append( config.item );
					}
					if(model.hookup) {
						model.hookup(config.item[0]);
					}
					var wrapper = lookupModel(model);
					config.item.
						data(ITEM_BINDING,wrapper.id).
						addClass(LIST_BINDING+id).
						trigger('add'+ns);
				});
			}
			function remove(ev,models) {
				_.each(models,function(model) {
					elements(model,el,true).remove();
				});
			}

			function notInList(list) {
				return _.isFunction( list.get ) ? function(item) {
					return list.get(item).length === 0;
				} : function(item) {
					return !~list.indexOf(item);
				};
			}

			function diffLists(oldList,newList) {
				// first remove anything in oldList not in newList
				remove(null, _.filter(oldList, notInList(newList) ));
				// then add anything in newList, not in old list
				var notInOld = notInList(oldList);
				_.each(newList, function(item,i) {
					if(notInOld(item)) {
						add(null, [item], i );
					}
				});
				// then pull the elements out in order and reappend them to
				// ensure the DOM order matches the list order
				var temp = $("<div/>");
				_.each(newList, function(item) {
					temp.append( elements(item,el).detach() );
				});
				el.append(temp.children());
			}

			function updateList() {
				if (ctx.unbind) {
					ctx.unbind('add',add);
					ctx.unbind('remove',remove);
				}
				var oldList = ctx;
				ctx = computedList();
				if (ctx.bind) {
					ctx.bind('add',add);
					ctx.bind('remove',remove);
				}
				diffLists(oldList,ctx);
			}

			// allow the list to be computed
			var computedList = compute(ctx);
			ctx = computedList();
			computedList.bind("change",updateList);

			if (ctx.bind) {
				ctx.bind('add',add);
				ctx.bind('remove',remove);
			}
			el.bind('destroyed',function() {
				if (ctx.unbind) {
					ctx.unbind('add',add);
					ctx.unbind('remove',remove);
				}
				computedList.unbind("change",updateList);
				delete lists[id];
			});
			// add all the existing models
			add(null,ctx);
		});
	});

	// just saves the item template for the current list
	Handlebars.registerHelper('bindItem',function(ctx,options) {
		lists[listId].tmpl = (options || ctx).fn;
		return '';
	});

	Handlebars.registerHelper('bindProp',function(ctx,options) {
		return bindMany.call(this,ctx,options,function(el,value,prop) {
			el.prop(prop,value);
		});
	});

	Handlebars.registerHelper('bindText',function(attr,options) {
		return bindOne.call(this,attr,options,function(el,text) {
			el.text(""+text);
		});
	});

	Handlebars.registerHelper('bindVal',function(attr,options) {
		var def = options && options.hash && options.hash['default'];
		return bindOne.call(this,attr,options,function(el,val) {
			var old = el.val();
			if(old !== val) {
				// the default value comes into play if val is undefined
				// or null (hence ==) because 0 or the empty string is OK
				/*jshint eqnull:true */
				el.val(""+((val == null && def != null) ? def : val));
			}
		});
	});

	Handlebars.registerHelper('bindSelect',function(attr,options) {
		return bindOne.call(this,attr,options,function(el,val) {
			el.find('option').filter(function() {
				return String($(this).val()) === String(val);
			}).prop('selected',true);
		});
	});

	var Live;

	var contents = {},
		contentId = 0;
	Handlebars.registerHelper("bindContent", function(options) {
		var cid = ++contentId,
			ctx = this;
		// the batch pa
		var afterBatch = options.hash.batch || Live.afterBatch;
		return addHookup(function(el) {
			var content = contents[cid];
			delete contents[cid];

			// update the HTML whenever it changes
			var html = compute(function () {
				return content.fn(this);
			}, ctx);
			function update() {
				el.html(html());
			}
			bindings({
				html: html
			}, el, function(html) {
				return [html, function() {
					afterBatch("lh-bind-content-" + cid, update);
				}];
			});
			update();
		});
	});
	Handlebars.registerHelper("content", function(options) {
		contents[contentId] = options;
	});


	// HACK have to overwrite hookupModel because it doesn't support multiple hookups
	Handlebars.registerHelper('hookupModel',function(ctx,options) {
		var model = ctx && ctx.bind && ctx || this;
		return addHookup(function(el) {
			model.hookup(el[0]);
		});
	});

	Live = {
		/**
		 * Overwrite to batch updates (currently only supported by bindContent).
		 * 
		 * Batching updates can dramatically improve performance if you know that
		 * the computed value will change several times before settling on the
		 * final value.
		 *
		 * @param {String} uniqueId an id that uniquely identifies the update.
		 * Subsequent calls with the same uniqueId should cancel any previous
		 * update with the same uniqueId that have not yet run.
		 *
		 * @param {function} fn the function to run after the batch.
		 */
		afterBatch: function(uniqueId, update) {
			update();
		},
		/**
		 * Hook for building your own live bindings.
		 * Usage:
		 addBindings.call(this,{key:'attribute'},function(el,attrValue,key) {
			// update el
			// attrValue is the bound value
			// key is the key you used in attrs
		 });
		 */
		addBindings: function(attrs,update,ctx) {
			/*jshint validthis:true */
			return bindMany.call(this,ctx || this,{hash:attrs},update);
		},
		/**
		 * @param {Function} fn the function to hookup. Will be passed the element when
		 * it is rendered.
		 * @return {String} the hookup data attribute definition.
		 */
		addHookup: addHookup
	};

	return Live;
});
