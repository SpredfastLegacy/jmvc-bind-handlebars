steal("funcunit/qunit","jquery/model","jquery/model/list","live_handlebars","jquery/lang/observe",
	function() {

	module("live_handlebars");

	var TestModel = can.Model({});

	function render(tmpl,data,fn) {
		var el = $('<div />').appendTo($('body')).
			html(can.view('//live_handlebars/test_views/'+tmpl+'.mustache',data));
		(fn(el) || $.Deferred().resolve()).then(function() {
			el.remove();
		});
	}

	test("bindAttr", function(){
		var model = new $.Observe({foo:123,bar:'abc'});
		render('bindAttr',model,function(el) {
			equals(el.find('button').attr('name'),'123','can bind by name');
			equals(el.find('button').attr('title'),'foo-abc','can bind and interpolate');

			model.attr({foo:'def',bar:456});

			equals(el.find('button').attr('name'),'def','named binding is updated');
			equals(el.find('button').attr('title'),'foo-456','interpolated binding is updated');
		});
	});
	test("bindClass", function(){
		var list = new can.Observe.List([]);
		var model = new can.Observe({foo:true,list:list});
		render('bindClass',model,function(el) {
			el = el.find('input');
			ok(el.hasClass('foo'),'class is added');
			ok(!el.hasClass('bar'),'class is not added');
			ok(!el.hasClass('baz'),'list class is not added');
			ok(el.hasClass('qux'),'list class is added');

			model.attr('foo',false);
			list.push(new $.Observe({}));

			ok(el.hasClass('bar'),'class is added');
			ok(!el.hasClass('foo'),'class is removed');
			ok(el.hasClass('baz'),'list class is removed');
			ok(!el.hasClass('qux'),'list class is added');

		});
	});
	test("bindHtml", function(){
		var model = new $.Observe({foo:'<em>Hello</em> World!'});
		render('bindHtml',model,function(el) {
			el = el.find('p');
			equals(el.html().toLowerCase(),'<em>Hello</em> World!'.toLowerCase());

			model.attr('foo','Hi Bob.');

			equals(el.html(),'Hi Bob.');
		});
	});
	test("bindIf", function(){
		var model = new ($.Model)({foo:{boolean:false,bar:123}});
		render('bindIf',model,function(parent) {
			var el = parent.find('p');
			equals(el.text(),'Not foo','renders else');

			model.attr('foo.boolean',true);

			equals(parent.find('p').text(),'Foo: 123');
		});
	});
	test("bindList", function(){
		expect(5);
		var list = TestModel.models([{
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
				equals($.map(el.find('.name'),function(el) { return $(el).text(); }).join(' '),
					values, message);
			}

			names('in order by name','abc bar foo xyz');
			list.remove(list[1]);
			names('item removed','abc foo xyz');
			list.push(TestModel.model({name:'beforeMe',id:6}));
			names('item added','abc beforeMe foo xyz');

			el.one('beforeAdd.hello',function(ev,data) {
				data.before = el.find('[data-name="beforeMe"]');
			});
			el.one('add.hello',function(ev) {
				equals($(ev.target).data('name'),'xxx','add event published');
			});
			list.push(TestModel.model({name:'xxx',id:7}));
			names('insertion point changed','abc xxx beforeMe foo xyz');
		});
	});
	test("bindList - Observe.List of simple values", function(){
		expect(5);
		var list = new $.Observe.List([
			'foo','bar','xyz','abc'
		]);
		render('bindObserveList',list,function(el) {
			el = el.find('ul');

			function names(message,values) {
				equals($.map(el.find('li'),function(el) { return $(el).text(); }).join(' '),
					values, message);
			}

			names('in order by name','abc bar foo xyz');
			list.splice(1,1);
			names('item removed','abc foo xyz');
			list.push('beforeMe');
			names('item added','abc beforeMe foo xyz');

			el.one('beforeAdd.hello',function(ev,data) {
				data.before = el.find('li:contains("beforeMe")');
			});
			el.one('add.hello',function(ev) {
				equals($(ev.target).text(),'xxx','add event published');
			});
			list.push('xxx');
			names('insertion point changed','abc xxx beforeMe foo xyz');
		});
	});
	test("bindList - Observe.List of Observe", function(){
		expect(5);
		var list = new $.Observe.List([{
			name: 'foo',
			count: 0
		},{
			name: 'bar',
			count: 1
		},{
			name: 'xyz',
			count: 5
		},{
			name: 'abc',
			count: 3
		}]);
		render('bindList',list,function(el) {
			el = el.find('ul');

			function names(message,values) {
				equals($.map(el.find('.name'),function(el) { return $(el).text(); }).join(' '),
					values, message);
			}

			names('in order by name','abc bar foo xyz');
			list.splice(1,1);
			names('item removed','abc foo xyz');
			list.push(new $.Observe({name:'beforeMe',id:6}));
			names('item added','abc beforeMe foo xyz');

			el.one('beforeAdd.hello',function(ev,data) {
				data.before = el.find('[data-name="beforeMe"]');
			});
			el.one('add.hello',function(ev) {
				equals($(ev.target).data('name'),'xxx','add event published');
			});
			list.push(new $.Observe({name:'xxx',id:7}));
			names('insertion point changed','abc xxx beforeMe foo xyz');
		});
	});
	test("bindList - Unsorted", function(){
		expect(8);
		var list = new $.Observe.List([
			'foo','bar','xyz','abc'
		]);
		render('bindListUnsorted',list,function(el) {
			el = el.find('ul');

			function names(message,values) {
				equals($.map(el.find('li'),function(el) { return $.trim($(el).text()); }).join(' '),
					values, message);
			}

			names('in order by name','Top foo bar xyz abc');
			list.splice(1,1,'beforeMe');
			names('item spliced','Top foo beforeMe xyz abc');

			el.one('beforeAdd.hello',function(ev,data) {
				data.before = el.find('li:contains("beforeMe")');
			});
			el.one('add.hello',function(ev) {
				equals($(ev.target).text(),'yyy','add event published');
			});
			list.push('yyy');
			names('insertion point changed','Top foo yyy beforeMe xyz abc');
			list.unshift('xxx');
			names('unshift','Top xxx foo yyy beforeMe xyz abc');
			list.splice(0,list.length);
			names('cleared','Top');
			list.push('blah','goo','gah');
			names('added to front','Top blah goo gah');
			list.push('foo','bar','baz');
			names('added to end','Top blah goo gah foo bar baz');
		});
	});
	test("bindProp", function(){
		var model = new $.Observe({foo:true});
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
		var model = new $.Observe({foo:'<Hello> World!'});
		render('bindText',model,function(el) {
			el = el.find('p');
			equals(el.text(),'<Hello> World!');

			model.attr('foo','Hi Bob.');

			equals(el.text(),'Hi Bob.');
		});
	});
	test("bindVal", function(){
		var model = new $.Observe({foo:'foo'});
		render('bindVal',model,function(el) {
			el = el.find('input');
			equals(el.val(),'foo-foo');

			model.attr('foo','bar');

			equals(el.val(),'foo-bar');

			model.attr('foo','');
			equals(el.last().val(),'');
		});
	});

	test("bindSelect", function(){
		var model = new $.Observe({foo:'b'});
		render('bindSelect',model,function(el) {
			el = el.find('select');
			equals(el.find(':selected').val(),'b');

			model.attr('foo','c');
			equals(el.find(':selected').val(),'c');

			model.attr('foo',42);
			equals(el.find(':selected').val(),'42');
		});
	});

	test("derrived attributes", function(){
	});

	test("method calls", function(){
	});

	test("hookupModel", function(){
		var model = new TestModel({foo:'foo'});
		render('hookupModel',model,function(el) {
			equals( el.find('div').model(), model, 'model hooked up' );
		});
	});

	test("kitchenSink", function(){
		// TODO
	});
});
