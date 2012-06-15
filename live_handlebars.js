steal.plugins('mustache','common','jquery/lang','jquery/model').then(function($){

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
		return new Handlebars.SafeString('data-view-id="' +
			$.View.hookup(runHookups) +
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
		if(bindTo.match(TMPL)) {
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
		} else {
			return obj.attr(attrs);
		}
	}

	// record attribute accesses while we do the initial load
	var realAttr = $.Model.prototype.attr;
	$.Model.prototype.attr = function(attr,val) {
		if($.Model.__reading && typeof val === 'undefined') {
			$.Model.__reading(this,attr);
		}
		return realAttr.apply(this,arguments);
	};

	function trapObserved(update) {
		var observed = [], old = $.Model.__reading;
		$.Model.__reading = function(obj,attr) {
			observed.push({obj:obj,attr:attr});
		};
		update();
		$.Model.__reading = old;
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
		return addHookup(function(el) {
			bindings.call(ctx,options.hash,el,function(bindTo,key) {
				var tmpl = bindTo.match(TMPL);
				var not = !tmpl && bindTo[0] === '!';
				bindTo = not ? bindTo.substring(1) : bindTo;
				function simpleUpdate() {
					var value = getValue(ctx,bindTo);
					update.call(ctx,el,
						tmpl ? $.String.sub(bindTo,value) :
							not ? !value : value,
						key);
				}
				return [trapObserved(simpleUpdate),simpleUpdate];
			});
		});
	}

	// bind to a single attribute change
	function bindOne(attr,options,update) {
		var ctx = options.context || this;
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
			el.toggleClass(className,!!condition);
		});
	});

	Handlebars.registerHelper('bindHtml',function(attr,options) {
		return bindOne.call(this,attr,options,function(el,html) {
			el.html(html);
		});
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
				return sortBy($(item).model(model.Class)) > value;
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
			el.text(text);
		});
	});

	Handlebars.registerHelper('bindVal',function(attr,options) {
		return bindOne.call(this,attr,options,function(el,val) {
			el.val(val);
		});
	});


	// HACK have to overwrite hookupModel because it doesn't support multiple hookups
	Handlebars.registerHelper('hookupModel',function() {
		var model = this;
		return addHookup(function(el) {
			model.hookup(el);
		});
	});

});
