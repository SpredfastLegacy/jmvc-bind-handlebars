/**
 * (c) 2012 Spredfast, Inc. BSD Licensed; see LICENSE.txt
 */
steal("jquery","jquery/lang/string","jquery/model","mustache",function() {

	var toString = Object.prototype.toString;

	var _ = {
		map: function(obj,iterator,context) {
			return $.map(obj,function(value,key) {
				return iterator.call(context,value,key);
			});
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
			$.View.hook(runHookups) +
		'" '+PREFIX+id);
	}

	function bindings(obj,el,createBinder) {
		var model = this;
		_.map(obj,function(value,key,obj) {
			var binding = createBinder.call(this,value,key,obj),
				observed = binding[0],
				binder = binding[1];
			_.each(observed,function(o) {
				o.obj.bind(o.attr,binder);
			});
			el.bind('destroyed',function() {
				_.each(observed,function(o) {
					o.obj.unbind(o.attr,binder);
				});
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

	function trapObserved(update) {
		var observed = [], old = can.Observe.__reading;
		can.Observe.__reading = function(obj,attr) {
			observed.push({obj:obj,attr:attr});
		};
		update();
		can.Observe.__reading = old;
		return observed;
	}

	// add a binding based on doing substitions on the value for each name="value" pair
	// in the options hash
	// either ctx or this is bound to, depending on who has a bind function
	function bindMany(ctx,options,update) {
		if(!ctx.bind) {
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
					bindTo = length ? bindTo.substring(1) : bindTo;
				}
				function simpleUpdate() {
					var value = getValue(ctx,bindTo);
					if(length) {
						value = value && value.length;
					}
					update.call(ctx,el,
						tmpl ? $.String.sub(bindTo,value) :
							not ? !value : value,
						key);
				}
				var bound = trapObserved(simpleUpdate);
				// if it's the length, add a binding to update on add & remove
				if(length) {
					var list = getValue(ctx,bindTo);
					if(!list) {
						throw new Error(bindTo+' is not defined.');
					}
					bound.push({
						obj: list,
						attr: 'add remove'
					});
				}
				return [bound,simpleUpdate];
			});
		};
	}

	// bind to a single attribute change
	function bindOne(attr,options,update) {
		var ctx = options.hash.context || this;
		return bindMany.call(this,ctx,{hash:{attr:attr}},update);
	}

	// run all the hookups attached to el
	function runHookups(el) {
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
			templateContext = this;
		return '<span ' + addHookup(function(el) {
			var parent = $(el).parent(),
				bind = {_changed:attr},
				content = $(el);
			if(!parent.length) {
				throw new Error('Cannot use bindIf without a wrapper element.');
			}
			bindingsSetup(ctx,bind,function(parent,condition) {
				var newContent = $('<div/>').
					html( (condition ? options.fn : options.inverse)(templateContext) ).
					children();

				if(!newContent.length) {
					newContent = $('<span></span>');
				}

				content.replaceWith(newContent);
				content = newContent;
			})(parent);
		}) +'></span>';
	});

	Handlebars.registerHelper('bindList',function(ctx,options) {
		if(!ctx.bind) {
			options = ctx;
			ctx = this;
		}
		lists[++listId] = {};
		var id = listId, ns = '',
			sort = options.hash.sortBy;
		var sortBy = sort ? _.isFunction(sort) ? sort : function(model) {
			return model && model.attr(sort);
		} : false;
		if(options.hash.namespace) {
			ns = '.' + options.hash.namespace;
		}
		function findBefore(model,el) {
			if(!sortBy) return;

			var value = sortBy(model);
			var before = _.find(ctx.elements(el),function(item) {
				return sortBy($(item).model(model.constructor)) > value;
			});
			return before && $(before);
		}
		return addHookup(function(el) {
			function add(ev,models) {
				_.each(models,function(model) {
					var config = {
						appendTo: el,
						before: findBefore(model,el),
						item: $(lists[id].tmpl(model))
					};
					el.trigger('beforeAdd'+ns,config);
					if(config.before) {
						config.before.before( config.item );
					} else {
						config.appendTo.append( config.item );
					}
					model.hookup(config.item[0]);
					config.item.trigger('add'+ns);
				});
			}
			function remove(ev,models) {
				_.each(models,function(model) {
					// remove any descendant of el for this model
					model.elements(el).remove();
				});
			}
			ctx.bind('add',add);
			ctx.bind('remove',remove);
			el.bind('destroyed',function() {
				ctx.unbind('add',add);
				ctx.unbind('remove',remove);
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


	// HACK have to overwrite hookupModel because it doesn't support multiple hookups
	Handlebars.registerHelper('hookupModel',function(ctx,options) {
		var model = ctx && ctx.bind && ctx || this;
		return addHookup(function(el) {
			model.hookup(el[0]);
		});
	});

});
