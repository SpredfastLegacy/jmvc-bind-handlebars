steal.plugins("funcunit/qunit", "live_handlebars",'jquery/model','jquery/model/list').then(function() {

	module("live_handlebars");

	function render(tmpl,data,fn) {
		var el = $('<div />').appendTo($('body')).
			html($.View('//live_handlebars/test_views/'+tmpl+'.mustache',data));
		(fn(el) || $.Deferred().resolve()).then(function() {
			el.remove();
		});
	}

	test("bindAttr", function(){
		var model = new ($.Model)({foo:123,bar:'abc'});
		render('bindAttr',model,function(el) {
			equals(el.find('button').attr('name'),'123','can bind by name');
			equals(el.find('button').attr('title'),'foo-abc','can bind and interpolate');

			model.attrs({foo:'def',bar:456});

			equals(el.find('button').attr('name'),'def','named binding is updated');
			equals(el.find('button').attr('title'),'foo-456','interpolated binding is updated');
		});
	});
	test("bindClass", function(){
		var model = new ($.Model)({foo:true});
		render('bindClass',model,function(el) {
			el = el.find('input');
			ok(el.hasClass('foo'),'class is added');
			ok(!el.hasClass('bar'),'class is not added');

			model.attr('foo',false);

			ok(el.hasClass('bar'),'class is added');
			ok(!el.hasClass('foo'),'class is removed');
		});
	});
	test("bindHtml", function(){
		var model = new ($.Model)({foo:'<em>Hello</em> World!'});
		render('bindHtml',model,function(el) {
			el = el.find('p');
			equals(el.html(),'<em>Hello</em> World!');

			model.attr('foo','Hi Bob.');

			equals(el.html(),'Hi Bob.');
		});
	});
	test("bindList", function(){
		expect(5);
		var list = $.Model.models([{
			id: 1,
			name: 'foo',
			count: 0
		},{
			id: 2,
			name: 'bar',
			count: 1
		},{
			id: 3,
			name: 'xyz',
			count: 5
		},{
			id: 4,
			name: 'abc',
			count: 3
		}]);
		render('bindList',list,function(el) {
			el = el.find('ul');

			function names(message,values) {
				equals(_.map(el.find('.name'),function(el) { return $(el).text(); }).join(' '),
					values, message);
			}

			names('in order by name','abc bar foo xyz');
			list.remove(list[1]);
			names('item removed','abc foo xyz');
			list.push($.Model.model({name:'beforeMe',id:6}));
			names('item added','abc beforeMe foo xyz');

			el.one('beforeAdd.hello',function(ev,data) {
				data.before = el.find('[data-name="beforeMe"]');
			});
			el.one('add.hello',function(ev) {
				equals($(ev.target).data('name'),'xxx','add event published');
			});
			list.push($.Model.model({name:'xxx',id:7}));
			names('insertion point changed','abc xxx beforeMe foo xyz');
		});
	});
	test("bindProp", function(){
		var model = new ($.Model)({foo:true});
		render('bindProp',model,function(el) {
			el = el.find('input');
			ok(!el.is(':checked'),'is not checked');
			ok(el.is(':disabled'),'is disabled');

			model.attr('foo',false);

			ok(el.is(':checked'),'is checked');
			ok(!el.is(':disabled'),'is enabled');
		});
	});
	test("bindText", function(){
		var model = new ($.Model)({foo:'<Hello> World!'});
		render('bindText',model,function(el) {
			el = el.find('p');
			equals(el.text(),'<Hello> World!');

			model.attr('foo','Hi Bob.');

			equals(el.text(),'Hi Bob.');
		});
	});
	test("bindVal", function(){
		var model = new ($.Model)({foo:'foo'});
		render('bindVal',model,function(el) {
			el = el.find('input');
			equals(el.val(),'foo-foo');

			model.attr('foo','bar');

			equals(el.val(),'foo-bar');
		});
	});

	test("derrived attributes", function(){
	});

	test("method calls", function(){
	});

	test("hookupModel", function(){
		var model = new ($.Model)({foo:'foo'});
		render('hookupModel',model,function(el) {
			equals( el.find('div').model(), model, 'model hooked up' );
		});
	});

	test("kitchenSink", function(){
		// TODO
	});
});
