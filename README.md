# Live Handlebars

Live Handlebars is a set of Handlebars helpers for use with CanJS (formerly JavaScriptMVC), that allows you to bind `can.Observe`s to DOM elements.

## Helpers

There are two types of basic live binding helper. One is intended to bind to a single attribute. i.e., bindHtml, bindSelect, bindText and bindVal. These helpers expect the first argument to be unnamed and be the name of the attribute to bind. e.g.,

Both types can take either a string (an attribute key) or a function as the binding. If a function is given, it is applied to the current context. Functions are bound using `can.compute`, so they will update just like attributes.

```
<div {{bindHtml "foo"}}/>
<!-- Output: { foo: '<em>Hi</em> mom!' } -->
<div><em>Hi</em> mom!</div>
```

These kinds of helpers can take an optional `context` named parameter, which will be used to resolve the attribute. e.g.,

```
<div {{bindHtml "html" context=foo}}/>
<!-- Output: { foo: { html: '<em>Hi</em> mom!' } } -->
<div><em>Hi</em> mom!</div>
```

Note the quotes around "html", but not `foo`.

The second type is intended to bind multiple keys to attributes. i.e., bindAttr, bindClass and bindProp. e.g.,

```
<div {{bindClass foo="foo" bar="!bar" baz="baz"}}/>
<!-- Output: { foo: true, bar: false } -->
<div class="foo bar"/>
```

Note that `!` can prefix an attribute name to negate it.

You can set the context for this kind of helper by passing an unnamed first argument:

```
<div {{bindClass obj foo="foo" bar="!bar" baz="baz"}}/>
<!-- Output: { obj: { foo: true, bar: false } } -->
<div class="foo bar"/>
```

Many helpers accept interpolation with the `{attr}` syntax. e.g.,

```
<div {{bindHtml "Message: {foo}"}} {{bindAttr data-bar="foo-{foo}"}} />
<!-- Output: { foo: "Hello" } -->
<div data-bar="foo-Hello">Message: Hello</div>
```

In addition there are the special purpose bindList+bindItem and bindIf, explained below.

### bindAttr

```
<div {{bindAttr data-foo="foo" id="bar"}}/>
<!-- Output: { foo: "Hello", bar: "Bob" } -->
<div data-foo="Hello" id="Bob"/>
```

### bindClass

```
<div {{bindClass foo="foo" bar="!bar" baz="baz"}}/>
<!-- Output: { foo: true, bar: false } -->
<div class="foo bar"/>
```

### bindHtml

```
<div {{bindHtml "foo"}}/>
<!-- Output: { foo: '<em>Hi</em> mom!' } -->
<div><em>Hi</em> mom!</div>
```

### bindIf

Renders its body if a condition is true (otherwise the else block) and removes/adds the content if the condition changes.

```
{{#bindIf "count"}}
	<p>Got <span {{bindText "count"}}/> results.</p>
{{else}}
	<p>Nothing.</p>
{{/bindIf}}
<!-- Output: { count: 0 } -->
	<p>Nothing.</p>
<!-- Output: { count: 2 } -->
	<p>Got <span>2</span> results.</p>
```

### bindList & bindItem

Binds an element to a `can.Observe.List` (either an instance or a function/compute that returns a List) and renders items inside its body. `bindItem` specifies the template for each item.

```
<ol {{bindList myList}}>
{{#bindItem}}
	<li>{{this}}
{{/bindItem}}
</ol>
<!-- Output: { myList: [1,2,3] } -->
<ol>
	<li>1
	<li>2
	<li>3
</ol>
```

Note that there are no quotes around `myList`.

### bindProp

```
<input {{bindProp checked="foo"}}>
<!-- Output: { foo: true } -->
<input checked>
```

Remember that some properties are boolean values. e.g., `checked`; whatever value is returned by your model is what will be set.

### bindSelect

```
<select {{bindSelect "value"}}>
	<option>foo</option>
	<option>bar</option>
	<option>baz</option>
</select>
<!-- Output: { value: "bar" } -->
<select>
	<option>foo</option>
	<option selected>bar</option>
	<option>baz</option>
</select>
```

### bindText

```
<div {{bindHtml "foo"}}/>
<!-- Output: { foo: '<em>Hi</em> mom!' } -->
<div>&lt;em&gt;Hi&lt;/em&gt; mom!</div>
```

### bindVal

```
<input {{bindValue "value"}}>
<!-- Output: { value: "bar" } -->
<input value="bar">
```

## Custom Helpers

```javascript
steal("live_handlebars",function(Live) {
	Handlebars.registerHelper("myLiveHelper",function(context) {
		return Live.addBinding.call(this,{
			foo: "bar"
		},function(el,bar,foo) {
			// foo === "foo"
			// bar === the value of context.attr("bar")
			// el === the element the binding is being applied to
		},context);
	});
});
```
