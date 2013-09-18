steal("can",
	"./test_views/bindClass.mustache", "./test_views/bindHtml.mustache",
	"./test_views/bindIf.mustache", "./test_views/bindAttr.mustache",
	"./test_views/bindList.mustache", "./test_views/bindListAndIf.mustache",
	"./test_views/bindListComputed.mustache", "./test_views/bindListUnsorted.mustache",
	"./test_views/bindObserveList.mustache", "./test_views/bindProp.mustache",
	"./test_views/bindSelect.mustache", "./test_views/bindText.mustache",
	"./test_views/bindVal.mustache", "./test_views/hookupModel.mustache",
	"./test_views/nestedBindIf.mustache",
	"./test_views/bindContent.mustache", "underscore",
	"jquery", "funcunit/qunit", "jquery/model", "jquery/model/list", "live_handlebars",
	"can/observe/list",
function(can,
bindClass, bindHtml,
bindIf, bindAttr,
bindList, bindListAndIf,
bindListComputed, bindListUnsorted,
bindObserveList, bindProp,
bindSelect, bindText,
bindVal, hookupModel,
nestedBindIf,
bindContent, _,
$) {
	"use strict";
	/*global module, test, equal, ok, expect */

	module("live_handlebars");

	var TestModel = can.Model({});

	function joinText(els) {
		return $.map(els, function(el) {
			return $.trim($(el).text());
		}).join(' ');
	}

	function render(tmpl, data, fn) {
		var el = $('<div />').appendTo($('body')).
		html(tmpl(data));
		(fn(el) || $.Deferred().resolve()).then(function() {
			el.remove();
		});
	}

	test("bindAttr", function() {
		var model = new can.Observe({
			foo: 123,
			bar: 'abc'
		});
		render(bindAttr, model, function(el) {
			equal(el.find('button').attr('name'), '123', 'can bind by name');
			equal(el.find('button').attr('title'), 'foo-abc', 'can bind and interpolate');

			model.attr({
				foo: 'def',
				bar: 456
			});

			equal(el.find('button').attr('name'), 'def', 'named binding is updated');
			equal(el.find('button').attr('title'), 'foo-456', 'interpolated binding is updated');
		});
	});
	test("bindClass", function() {
		var list = new can.Observe.List([]);
		var model = new can.Observe({
			foo: true,
			list: list
		});
		render(bindClass, model, function(el) {
			el = el.find('input');
			ok(el.hasClass('foo'), 'class is added');
			ok(!el.hasClass('bar'), 'class is not added');
			ok(!el.hasClass('baz'), 'list class is not added');
			ok(el.hasClass('qux'), 'list class is added');

			model.attr('foo', false);
			list.push(new can.Observe({}));

			ok(el.hasClass('bar'), 'class is added');
			ok(!el.hasClass('foo'), 'class is removed');
			ok(el.hasClass('baz'), 'list class is removed');
			ok(!el.hasClass('qux'), 'list class is added');

		});
	});
	test("bindHtml", function() {
		var model = new can.Observe({
			foo: '<em>Hello</em> World!'
		});
		render(bindHtml, model, function(el) {
			el = el.find('p');
			equal(el.html().toLowerCase(), '<em>Hello</em> World!'.toLowerCase());

			model.attr('foo', 'Hi Bob.');

			equal(el.html(), 'Hi Bob.');
		});
	});
	test("bindIf", function() {
		var model = new($.Model)({
			foo: {
				boolean: false,
				bar: 123
			}
		});
		render(bindIf, model, function(parent) {
			var el = parent.find('p');
			equal(el.text(), 'Not foo', 'renders else');

			model.attr('foo.boolean', true);

			equal(parent.find('p').text(), 'Foo: 123');
		});
	});
	test("bindList", function() {
		expect(5);
		var list = TestModel.models([{
			id: 1,
			name: 'foo',
			count: 0
		}, {
			id: 2,
			name: 'bar',
			count: 1
		}, {
			id: 3,
			name: 'xyz',
			count: 5
		}, {
			id: 4,
			name: 'abc',
			count: 3
		}]);
		render(bindList, list, function(el) {
			el = el.find('ul');

			function names(message, values) {
				equal(joinText(el.find('.name')), values, message);
			}

			names('in order by name', 'abc bar foo xyz');
			list.remove(list[1]);
			names('item removed', 'abc foo xyz');
			list.push(TestModel.model({
				name: 'beforeMe',
				id: 6
			}));
			names('item added', 'abc beforeMe foo xyz');

			el.one('beforeAdd.hello', function(ev, data) {
				data.before = el.find('[data-name="beforeMe"]');
			});
			el.one('add.hello', function(ev) {
				equal($(ev.target).data('name'), 'xxx', 'add event published');
			});
			list.push(TestModel.model({
				name: 'xxx',
				id: 7
			}));
			names('insertion point changed', 'abc xxx beforeMe foo xyz');
		});
	});
	test("bindList - Observe.List of simple values", function() {
		expect(5);
		var list = new can.Observe.List([
			'foo', 'bar', 'xyz', 'abc']);
		render(bindObserveList, list, function(el) {
			el = el.find('ul');

			function names(message, values) {
				equal(joinText(el.find('li')), values, message);
			}

			names('in order by name', 'abc bar foo xyz');
			list.splice(1, 1);
			names('item removed', 'abc foo xyz');
			list.push('beforeMe');
			names('item added', 'abc beforeMe foo xyz');

			el.one('beforeAdd.hello', function(ev, data) {
				data.before = el.find('li:contains("beforeMe")');
			});
			el.one('add.hello', function(ev) {
				equal($(ev.target).text(), 'xxx', 'add event published');
			});
			list.push('xxx');
			names('insertion point changed', 'abc xxx beforeMe foo xyz');
		});
	});
	test("bindList - Observe.List of Observe", function() {
		expect(5);
		var list = new can.Observe.List([{
			name: 'foo',
			count: 0
		}, {
			name: 'bar',
			count: 1
		}, {
			name: 'xyz',
			count: 5
		}, {
			name: 'abc',
			count: 3
		}]);
		render(bindList, list, function(el) {
			el = el.find('ul');

			function names(message, values) {
				equal(joinText(el.find('.name')), values, message);
			}

			names('in order by name', 'abc bar foo xyz');
			list.splice(1, 1);
			names('item removed', 'abc foo xyz');
			list.push(new can.Observe({
				name: 'beforeMe',
				id: 6
			}));
			names('item added', 'abc beforeMe foo xyz');

			el.one('beforeAdd.hello', function(ev, data) {
				data.before = el.find('[data-name="beforeMe"]');
			});
			el.one('add.hello', function(ev) {
				equal($(ev.target).data('name'), 'xxx', 'add event published');
			});
			list.push(new can.Observe({
				name: 'xxx',
				id: 7
			}));
			names('insertion point changed', 'abc xxx beforeMe foo xyz');
		});
	});
	test("bindList - Unsorted", function() {
		expect(8);
		var list = new can.Observe.List([
			'foo', 'bar', 'xyz', 'abc']);
		render(bindListUnsorted, list, function(el) {
			el = el.find('ul');

			function names(message, values) {
				equal(joinText(el.find('li')), values, message);
			}

			names('in order by name', 'Top foo bar xyz abc');
			list.splice(1, 1, 'beforeMe');
			names('item spliced', 'Top foo beforeMe xyz abc');

			el.one('beforeAdd.hello', function(ev, data) {
				data.before = el.find('li:contains("beforeMe")');
			});
			el.one('add.hello', function(ev) {
				equal($(ev.target).text(), 'yyy', 'add event published');
			});
			list.push('yyy');
			names('insertion point changed', 'Top foo yyy beforeMe xyz abc');
			list.unshift('xxx');
			names('unshift', 'Top xxx foo yyy beforeMe xyz abc');
			list.splice(0, list.length);
			names('cleared', 'Top');
			list.push('blah', 'goo', 'gah');
			names('added to front', 'Top blah goo gah');
			list.push('foo', 'bar', 'baz');
			names('added to end', 'Top blah goo gah foo bar baz');
		});
	});
	test("bindList - computed", function() {
		expect(6);
		var ifoo = 0;
		var Letter = can.Model({
			init: function() {
				this.list._foo = ifoo++;
			}
		});
		var filter = can.compute("");
		var items = new can.Observe.List(["red", "green", "blue", "read", "grow", "zebra"]);
		var groups = can.compute(function() {
			var groups = {};
			items.attr("length");
			can.each(items, function(value) {
				var letter = value[0].toLowerCase();
				groups[letter] = true;
			});
			return groups;
		});
		var list = can.compute(function() {
			return new Letter.List(can.map(groups(), function(list, letter) {
				return new Letter({
					id: letter,
					letter: letter,
					list: can.compute(function() {
						var matches = [];
						for (var i = 0; i < items.attr("length"); i++) {
							if (items[i][0].toLowerCase() === letter) {
								if (!filter() || ~items[i].indexOf(filter())) {
									matches.push(items[i]);
								}
							}
						}
						return new can.Observe.List(matches);
					})
				});
			}));
		});
		render(bindListComputed, list, function(el) {
			equal(joinText(el.find(".letter")), "r g b z");
			equal(el.find("[data-letter=r] .word").length, 2);

			// can we update the compute?
			items.splice(0, 3, "Red", "Green", "Black");
			equal(joinText(el.find("[data-letter=r] .word")), "Red read");
			equal(joinText(el.find("[data-letter=g] .word")), "Green grow");
			equal(joinText(el.find("[data-letter=b] .word")), "Black");
			// can we update a list inside the compute?
			var l = list()[1].list();
			filter("ee");
			equal(joinText(el.find("[data-letter=g] .word")), "Green");
		});
	});
	test("bindList - compute Array", function() {
		expect(6);
		var ifoo = 0;
		var Letter = can.Model({
			init: function() {
				this.list._foo = ifoo++;
			}
		});
		var filter = can.compute("");
		var items = new can.Observe.List(["red", "green", "blue", "read", "grow", "zebra"]);
		var groups = can.compute(function() {
			var groups = {};
			items.attr("length");
			can.each(items, function(value) {
				var letter = value[0].toLowerCase();
				groups[letter] = true;
			});
			return groups;
		});
		var list = can.compute(function() {
			return can.map(groups(), function(list, letter) {
				return new Letter({
					id: letter,
					letter: letter,
					list: can.compute(function() {
						var matches = [];
						for (var i = 0; i < items.attr("length"); i++) {
							if (items[i][0].toLowerCase() === letter) {
								if (!filter() || ~items[i].indexOf(filter())) {
									matches.push(items[i]);
								}
							}
						}
						return matches;
					})
				});
			});
		});
		render(bindListComputed, list, function(el) {
			equal(joinText(el.find(".letter")), "r g b z");
			equal(el.find("[data-letter=r] .word").length, 2);

			// can we update the compute?
			items.splice(0, 3, "Red", "Green", "Black");
			equal(joinText(el.find("[data-letter=r] .word")), "Red read");
			equal(joinText(el.find("[data-letter=g] .word")), "Green grow");
			equal(joinText(el.find("[data-letter=b] .word")), "Black");
			// can we update a list inside the compute?
			filter("ee");
			equal(joinText(el.find("[data-letter=g] .word")), "Green");
		});
	});
	test("bindList with bindIf", 2, function() {
		var data = new can.Observe({
			foo: false,
			bar: []
		});
		render(bindListAndIf, data, function(el) {
			function names(message, values) {
				equal(joinText(el.find('li')), values, message);
			}

			names('no names', '');
			data.attr({
				foo: true,
				bar: [{
					id: 1,
					name: 'foo'
				}, {
					id: 2,
					name: 'bar'
				}]
			}, true);
			names('names not duplicated', 'foo bar');
		});
	});
	test("bindProp", function() {
		var model = new can.Observe({
			foo: true
		});
		render(bindProp, model, function(el) {
			el = el.find('input');
			ok(!el.is(':checked'), 'is not checked');
			ok(el.is(':disabled'), 'is disabled');

			model.attr('foo', false);

			ok(el.is(':checked'), 'is checked');
			ok(!el.is(':disabled'), 'is enabled');
		});
	});
	test("bindText", function() {
		var model = new can.Observe({
			foo: '<Hello> World!'
		});
		render(bindText, model, function(el) {
			el = el.find('p');
			equal(el.text(), '<Hello> World!');

			model.attr('foo', 'Hi Bob.');

			equal(el.text(), 'Hi Bob.');
		});
	});
	test("bindVal", function() {
		var model = new can.Observe({
			foo: 'foo'
		});
		render(bindVal, model, function(el) {
			el = el.find('input');
			equal(el.val(), 'foo-foo');

			model.attr('foo', 'bar');

			equal(el.val(), 'foo-bar');

			model.attr('foo', '');
			equal(el.last().val(), '');
		});
	});

	test("bindSelect", function() {
		var model = new can.Observe({
			foo: 'b'
		});
		render(bindSelect, model, function(el) {
			el = el.find('select');
			equal(el.find(':selected').val(), 'b');

			model.attr('foo', 'c');
			equal(el.find(':selected').val(), 'c');

			model.attr('foo', 42);
			equal(el.find(':selected').val(), '42');
		});
	});

/* TODO TD-93
	test("nested bindIf is properly unbound", 6, function() {
		var Model = can.Model.extend({
			childCompute: function() {
				this.attr("cFlag");
				// it doesn't matter what this returns as long as cFlag is part of the compute
				return false;
			},
			// this choses between child and something else. if it's true, child is rendered
			parentCompute: function() {
				return this.attr("cFlag");
			}
		});

		var instance = new Model({
			id: 123,
			cFlag: false
		});

		function timeout(delay) {
			var done = $.Deferred();
			setTimeout(function() {
				done.resolve();
			}, delay || 25);
			return done.promise();
		}

		render(nestedBindIf, instance, function(el) {
			equal($.trim(el.text()), "Other");
			instance.attr({
				cFlag: true
			});

			equal($.trim(el.text()), "Child");

			instance.attr({
				cFlag: false
			});

			equal($.trim(el.text()), "Other");

			instance.attr({
				cFlag: true
			});
			ok(Model.store["123"], "model in store");
			equal($.trim(el.text()), "Child");

			el.html("<p>Hello world");
			ok(!Model.store["123"], "model not leaked in store");
		});
	});
//*/

	test("bindContent", function() {
		var queued = {};
		function afterBatch(uid, fn) {
			queued[uid] = fn;
		}
		function endBatch() {
			_.each(queued, function(fn) {
				fn();
			});
			queued = {};
		}
		var instance = new can.Observe({
			start: 1,
			end: 10,
			batch: afterBatch,
			listOfStuff: function() {
				return _.range(this.attr("start"), this.attr("end"));
			}
		});
		render(bindContent, instance, function(el) {
			equal(el.text().replace(/\s+/g," ").trim(), _.range(1,10).join(" "));

			instance.attr("start", 5);
			equal(el.text().replace(/\s+/g," ").trim(), _.range(1,10).join(" "),
				"batch prevents update during batch");
			instance.attr("end", 50);
			endBatch();

			equal(el.text().replace(/\s+/g," ").trim(), _.range(5,50).join(" "));
		});
	});

	test("derrived attributes", function() {
		expect(0);
	});

	test("method calls", function() {
		expect(0);
	});

	test("hookupModel", function() {
		var model = new TestModel({
			foo: 'foo'
		});
		render(hookupModel, model, function(el) {
			equal(el.find('div').model(), model, 'model hooked up');
		});
	});

	test("kitchenSink", function() {
		expect(0);
	});
});