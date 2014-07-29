/* 
 * Defiant.js v1.0.2 
 * Smart templating with XSLT and XPath. 
 * http://defiantjs.com 
 * 
 * Copyright (c) 2013-2014, Hakan Bilgin <hbi@longscript.com> 
 * Licensed under the MIT License 
 */ 

if (typeof module === "undefined") {
	var module = { exports: undefined };
} else {
	// Node env adaptation goes here...
}

module.exports = Defiant = (function(window, undefined) {
	'use strict';

	var Defiant = {
		is_ie     : /msie/i.test(navigator.userAgent),
		is_safari : /safari/i.test(navigator.userAgent),
		env       : 'production',
		xml_decl  : '<?xml version="1.0" encoding="utf-8"?>',
		namespace : 'xmlns:d="defiant-namespace"',
		tabsize   : 4,
		render: function(template, data) {
			var processor = new XSLTProcessor(),
				span      = document.createElement('span'),
				opt       = {match: '/'},
				tmplt_xpath,
				scripts,
				temp,
				sorter;
			// handle arguments
			switch (typeof(template)) {
				case 'object':
					this.extend(opt, template);
					if (!opt.data) opt.data = data;
					break;
				case 'string':
					opt.template = template;
					opt.data = data;
					break;
				default:
					throw 'error';
			}
			opt.data = JSON.toXML(opt.data);
			tmplt_xpath = '//xsl:template[@name="'+ opt.template +'"]';

			if (!this.xsl_template) this.gather_templates();

			if (opt.sorter) {
				sorter = this.node.selectSingleNode(this.xsl_template, tmplt_xpath +'//xsl:for-each//xsl:sort');
				if (sorter) {
					if (opt.sorter.order) sorter.setAttribute('order', opt.sorter.order);
					if (opt.sorter.select) sorter.setAttribute('select', opt.sorter.select);
					sorter.setAttribute('data-type', opt.sorter.type || 'text');
				}
			}

			temp = this.node.selectSingleNode(this.xsl_template, tmplt_xpath);
			temp.setAttribute('match', opt.match);
			processor.importStylesheet(this.xsl_template);
			span.appendChild(processor.transformToFragment(opt.data, document));
			temp.removeAttribute('match');

			if (this.is_safari) {
				scripts = span.getElementsByTagName('script');
				for (var i=0, il=scripts.length; i<il; i++) scripts[i].defer = true;
			}
			return span.innerHTML;
		},
		gather_templates: function() {
			var scripts = document.getElementsByTagName('script'),
				str     = '',
				i       = 0,
				il      = scripts.length;
			for (; i<il; i++) {
				if (scripts[i].type === 'defiant/xsl-template') str += scripts[i].innerHTML;
			}
			this.xsl_template = this.xmlFromString('<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" '+ this.namespace +'>'+ str.replace(/defiant:(\w+)/g, '$1') +'</xsl:stylesheet>');
		},
		xmlFromString: function(str) {
			var parser,
				doc;
			str = str.replace(/>\s{1,}</g, '><');
			if (str.trim().match(/<\?xml/) === null) {
				str = this.xml_decl + str;
			}
			if (this.is_ie) {
				doc = new ActiveXObject('Msxml2.DOMDocument');
				doc.loadXML(str);
				if (str.indexOf('xsl:stylesheet') === -1) {
					doc.setProperty('SelectionLanguage', 'XPath');
				}
			} else {
				parser = new DOMParser();
				doc = parser.parseFromString(str, 'text/xml');
			}
			return doc;
		},
		extend: function(src, dest) {
			for (var content in dest) {
				if (!src[content] || typeof(dest[content]) !== 'object') {
					src[content] = dest[content];
				} else {
					this.extend(src[content], dest[content]);
				}
			}
			return src;
		},
		node: {}
	};

	return Defiant;

})(this);



if (typeof(XSLTProcessor) === 'undefined') {

	// emulating XSLT Processor (enough to be used in defiant)
	var XSLTProcessor = function() {};
	XSLTProcessor.prototype = {
		importStylesheet: function(xsldoc) {
			this.xsldoc = xsldoc;
		},
		transformToFragment: function(data, doc) {
			var str = data.transformNode(this.xsldoc),
				span = document.createElement('span');
			span.innerHTML = str;
			return span;
		}
	};

}


// extending STRING
if (!String.prototype.fill) {
	String.prototype.fill = function(i,c) {
		var str = this;
		c = c || ' ';
		for (; str.length<i; str+=c){}
		return str;
	};
}

if (!String.prototype.trim) {
	String.prototype.trim = function () {
		return this.replace(/^\s+|\s+$/gm, '');
	};
}

/* temporary (!?)
 * - used to visual matching of search results
 */
if (!String.prototype.count_nl) {
	String.prototype.count_nl = function () {
		var m = this.match(/\n/g);
		return m ? m.length : 0;
	};
}
if (!String.prototype.notabs) {
	String.prototype.notabs = function () {
		return this.replace(/\t/g, '');
	};
}

if (typeof(JSON) === 'undefined') {
	window.JSON = {
		parse: function (sJSON) { return eval("(" + sJSON + ")"); },
		stringify: function (vContent) {
			if (vContent instanceof Object) {
				var sOutput = "";
				if (vContent.constructor === Array) {
					for (var nId = 0; nId < vContent.length; sOutput += this.stringify(vContent[nId]) + ",", nId++);
					return "[" + sOutput.substr(0, sOutput.length - 1) + "]";
				}
				if (vContent.toString !== Object.prototype.toString) {
					return "\"" + vContent.toString().replace(/"/g, "\\$&") + "\"";
				}
				for (var sProp in vContent) {
					sOutput += "\"" + sProp.replace(/"/g, "\\$&") + "\":" + this.stringify(vContent[sProp]) + ",";
				}
				return "{" + sOutput.substr(0, sOutput.length - 1) + "}";
			}
			return typeof vContent === "string" ? "\"" + vContent.replace(/"/g, "\\$&") + "\"" : String(vContent);
		}
	};
}
/* jshint ignore:end */

if (!JSON.toXML) {
	JSON.toXML = function(tree) {
		'use strict';

		var interpreter = {
			map: [],
			rx_validate_name : /^(?!xml)[a-z_][\w\d.:]*$/i,
			rx_node          : /<(.+?)( .*?)>/,
			rx_constructor   : /<(.+?)( d:contr=".*?")>/,
			rx_namespace     : / xmlns\:d="defiant\-namespace"/,
			rx_data          : /(<.+?>)(.*?)(<\/d:data>)/i,
			rx_function      : /function (\w+)/i,
			to_xml: function(tree) {
				var str = this.hash_to_xml(null, tree);
				return Defiant.xmlFromString(str);
			},
			hash_to_xml: function(name, tree, array_child) {
				var is_array = tree.constructor === Array,
					elem = [],
					attr = [],
					key,
					val,
					val_is_array,
					type,
					is_attr,
					cname,
					constr,
					cnName,
					i;

				for (key in tree) {
					val = tree[key];
					if (val === null || val === undefined || val.toString() === 'NaN') val = null;

					is_attr = key.slice(0,1) === '@';
					cname   = array_child ? name : key;
					if (cname == +cname && tree.constructor !== Object) cname = 'd:item';
					if (val === null) {
						constr = null;
						cnName = false;
					} else {
						constr = val.constructor;
						cnName = constr.toString().match(this.rx_function)[1];
					}

					if (is_attr) {
						attr.push( cname.slice(1) +'="'+ this.escape_xml(val) +'"' );
						if (cnName !== 'String') attr.push( 'd:'+ cname.slice(1) +'="'+ cnName +'"' );
					} else if (val === null) {
						elem.push( this.scalar_to_xml( cname, val ) );
					} else {
						switch (constr) {
							case Function:
								// if constructor is function, then it's not a JSON structure
								// throw 'ERROR!';
								break;
							case Object:
								elem.push( this.hash_to_xml( cname, val ) );
								break;
							case Array:
								if (key === cname) {
									val_is_array = val.constructor === Array;
									if (val_is_array) {
										i = val.length;
										while (i--) {
											if (val[i].constructor === Array) val_is_array = true;
											if (!val_is_array && val[i].constructor === Object) val_is_array = true;
										}
									}
									elem.push( this.scalar_to_xml( cname, val, val_is_array ) );
									break;
								}
								/* falls through */
							case String:
								if (typeof(val) === 'string') val = val.toString().replace(/\&/g, '&amp;');
								if (cname === '#text') {
									// prepare map
									this.map.push(tree);
									attr.push('d:mi="'+ this.map.length +'"');
									attr.push('d:constr="'+ cnName +'"');
									elem.push( this.escape_xml(val) );
									break;
								}
								/* falls through */
							case Number:
							case Boolean:
								if (cname === '#text' && cnName !== 'String') {
									// prepare map
									this.map.push(tree);
									attr.push('d:mi="'+ this.map.length +'"');
									attr.push('d:constr="'+ cnName +'"');
									elem.push( this.escape_xml(val) );
									break;
								}
								elem.push( this.scalar_to_xml( cname, val ) );
								break;
						}
					}
				}
				if (!name) {
					name = 'd:data';
					attr.push(Defiant.namespace);
					if (is_array) attr.push('d:constr="Array"');
				}
				if (name.match(this.rx_validate_name) === null) {
					attr.push( 'd:name="'+ name +'"' );
					name = 'd:name';
				}
				if (array_child) return elem.join('');
				// prepare map
				this.map.push(tree);
				attr.push('d:mi="'+ this.map.length +'"');

				return '<'+ name + (attr.length ? ' '+ attr.join(' ') : '') + (elem.length ? '>'+ elem.join('') +'</'+ name +'>' : '/>' );
			},
			scalar_to_xml: function(name, val, override) {
				var attr = '',
					text,
					constr,
					cnName;

				// check whether the nodename is valid
				if (name.match(this.rx_validate_name) === null) {
					attr += ' d:name="'+ name +'"';
					name = 'd:name';
					override = false;
				}
				if (val === null || val.toString() === 'NaN') val = null;
				if (val === null) return '<'+ name +' d:constr="null"/>';
				if (val.length === 1 && val[0].constructor === Object) {
					
					text = this.hash_to_xml(false, val[0]);

					var a1 = text.match(this.rx_node),
						a2 = text.match(this.rx_constructor);
					a1 = (a1 !== null)? a1[2]
								.replace(this.rx_namespace, '')
								.replace(/>/, '')
								.replace(/"\/$/, '"') : '';
					a2 = (a2 !== null)? a2[2] : '';

					text = text.match(this.rx_data);
					text = (text !== null)? text[2] : '';

					return '<'+ name + a1 +' '+ a2 +' d:type="ArrayItem">'+ text +'</'+ name +'>';
				} else if (val.length === 0 && val.constructor === Array) {
					return '<'+ name +' d:constr="Array"/>';
				}
				// else 
				if (override) {
					return this.hash_to_xml( name, val, true );
				}

				constr = val.constructor;
				cnName = constr.toString().match(this.rx_function)[1];
				text = (constr === Array)   ? this.hash_to_xml( 'd:item', val, true )
											: this.escape_xml(val);

				attr += ' d:constr="'+ cnName +'"';
				// prepare map
				this.map.push(val);
				attr += ' d:mi="'+ this.map.length +'"';

				return (name === '#text') ? this.escape_xml(val) : '<'+ name + attr +'>'+ text +'</'+ name +'>';
			},
			escape_xml: function(text) {
				return String(text) .replace(/</g, '&lt;')
									.replace(/>/g, '&gt;')
									.replace(/"/g, '&quot;')
									.replace(/&nbsp;/g, '&#160;');
			}
		},
		doc = interpreter.to_xml.call(interpreter, tree);

		this.search.map = interpreter.map;
		return doc;
	};
}


if (!JSON.search) {
	JSON.search = function(tree, xpath, single) {
		'use strict';
		
		var doc  = JSON.toXML(tree),
			xres = Defiant.node[ single ? 'selectSingleNode' : 'selectNodes' ](doc, xpath),
			i    = xres.length,
			ret  = [],
			mapIndex;

		if (single) xres = [xres];

		//console.log( 'x-RES:', xres );
		while (i--) {
			switch(xres[i].nodeType) {
				case 2:
				case 3: 
					ret.unshift( xres[i].nodeValue );
					break;
				default:
					mapIndex = +xres[i].getAttribute('d:mi');
					ret.unshift( this.search.map[mapIndex-1] );
			}
		}
		// if environment = development, add search tracing
		if (Defiant.env === 'development') {
			this.trace = JSON.mtrace(tree, ret, xres);
		}

		//console.log( 'RES:', ret );
		return ret;
	};
}


if (!JSON.mtrace) {
	JSON.mtrace = function(root, hits, xres) {
		'use strict';

		var win       = window,
			stringify = JSON.stringify,
			sroot     = stringify( root, null, '\t' ).notabs(),
			trace     = [],
			i         = 0,
			il        = xres.length,
			od        = il ? xres[i].ownerDocument.documentElement : false,
			map       = this.search.map,
			hstr,
			cConstr,
			mIndex,
			lStart,
			lEnd;

		for (; i<il; i++) {
			switch (xres[i].nodeType) {
				case 2:
					cConstr = xres[i].ownerElement.getAttribute('d:'+ xres[i].nodeName);
					hstr    = '"@'+ xres[i].nodeName +'": '+ win[ cConstr ]( hits[i] );
					mIndex  = sroot.indexOf(hstr);
					lEnd    = 0;
					break;
				case 3:
					cConstr = xres[i].parentNode.getAttribute('d:constr');
					hstr    = win[ cConstr ]( hits[i] );
					hstr    = '"'+ xres[i].parentNode.nodeName +'": '+ (hstr === 'Number' ? hstr : '"'+ hstr +'"');
					mIndex  = sroot.indexOf(hstr);
					lEnd    = 0;
					break;
				default:
					if (xres[i] === od) continue;
					if (xres[i].getAttribute('d:constr') === 'String') {
						cConstr = xres[i].getAttribute('d:constr');
						hstr    = win[ cConstr ]( hits[i] );
						hstr    = '"'+ xres[i].nodeName +'": '+ (hstr === 'Number' ? hstr : '"'+ hstr +'"');
						mIndex  = sroot.indexOf(hstr);
						lEnd    = 0;
					} else {
						hstr   = stringify( hits[i], null, '\t' ).notabs();
						mIndex = sroot.indexOf(hstr);
						lEnd   = hstr.match(/\n/g).length;
					}
			}
			lStart = sroot.substring(0,mIndex).match(/\n/g).length+1;
			trace.push([lStart, lEnd]);
		}
		
		return trace;
	};
}


Defiant.node.selectNodes = function(XNode, XPath) {
	if (XNode.evaluate) {
		var ns = XNode.createNSResolver(XNode.documentElement),
			qI = XNode.evaluate(XPath, XNode, ns, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null),
			res = [],
			i   = 0,
			il  = qI.snapshotLength;
		for (; i<il; i++) {
			res.push( qI.snapshotItem(i) );
		}
		return res;
	} else {
		return XNode.selectNodes(XPath);
	}
};
Defiant.node.selectSingleNode = function(XNode, XPath) {
	if (XNode.evaluate) {
		var xI = this.selectNodes(XNode, XPath);
		return (xI.length > 0)? xI[0] : null;
	} else {
		return XNode.selectSingleNode(XPath);
	}
};


Defiant.node.prettyPrint = function(node) {
	var root = Defiant,
		tabs = root.tabsize,
		decl = root.xml_decl.toLowerCase(),
		ser,
		xstr;
	if (root.is_ie) {
		xstr = node.xml;
	} else {
		ser  = new XMLSerializer();
		xstr = ser.serializeToString(node);
	}
	if (root.env !== 'development') {
		// if environment is not development, remove defiant related info
		xstr = xstr.replace(/ \w+\:d=".*?"| d\:\w+=".*?"/g, '');
	}
	var str    = xstr.trim().replace(/(>)\s*(<)(\/*)/g, '$1\n$2$3'),
		lines  = str.split('\n'),
		indent = -1,
		i      = 0,
		il     = lines.length,
		start,
		end;
	for (; i<il; i++) {
		if (i === 0 && lines[i].toLowerCase() === decl) continue;
		start = lines[i].match(/<[A-Za-z_\:]+.*?>/g) !== null;
		//start = lines[i].match(/<[^\/]+>/g) !== null;
		end   = lines[i].match(/<\/[\w\:]+>/g) !== null;
		if (lines[i].match(/<.*?\/>/g) !== null) start = end = true;
		if (start) indent++;
		lines[i] = String().fill(indent, '\t') + lines[i];
		if (start && end) indent--;
		if (!start && end) indent--;
	}
	return lines.join('\n').replace(/\t/g, String().fill(tabs, ' '));
};


Defiant.node.toJSON = function(xnode, stringify) {
	'use strict';

	var interpret = function(leaf) {
			var obj = {},
				win = window,
				attr,
				type,
				item,
				cname,
				cConstr,
				cval,
				text,
				i, il, a;

			switch (leaf.nodeType) {
				case 1:
					cConstr = leaf.getAttribute('d:constr');
					if (cConstr === 'Array') obj = [];
					else if (cConstr === 'String' && leaf.textContent === '') obj = '';

					attr = leaf.attributes;
					i = 0;
					il = attr.length;
					for (; i<il; i++) {
						a = attr.item(i);
						if (a.nodeName.match(/\:d|d\:/g) !== null) continue;

						cConstr = leaf.getAttribute('d:'+ a.nodeName);
						if (cConstr && cConstr !== 'undefined') {
							if (a.nodeValue === 'null') cval = null;
							else cval = win[ cConstr ]( (a.nodeValue === 'false') ? '' : a.nodeValue );
						} else {
							cval = a.nodeValue;
						}
						obj['@'+ a.nodeName] = cval;
					}
					break;
				case 3:
					type = leaf.parentNode.getAttribute('d:type');
					cval = (type) ? win[ type ]( leaf.nodeValue === 'false' ? '' : leaf.nodeValue ) : leaf.nodeValue;
					obj = cval;
					break;
			}
			if (leaf.hasChildNodes()) {
				i = 0;
				il = leaf.childNodes.length;
				for(; i<il; i++) {
					item  = leaf.childNodes.item(i);
					cname = item.nodeName;
					attr  = leaf.attributes;

					if (cname === 'd:name') {
						cname = item.getAttribute('d:name');
					}
					if (cname === '#text') {
						cConstr = leaf.getAttribute('d:constr');
						if (cConstr === 'undefined') cConstr = undefined;
						text = item.textContent || item.text;
						cval = cConstr === 'Boolean' && text === 'false' ? '' : text;

						if (!cConstr && !attr.length) obj = cval;
						else if (cConstr && il === 1) {
							obj = win[cConstr](cval);
						} else if (!leaf.hasChildNodes()) {
							obj[cname] = (cConstr)? win[cConstr](cval) : cval;
						} else {
							if (attr.length < 3) obj = (cConstr)? win[cConstr](cval) : cval;
							else obj[cname] = (cConstr)? win[cConstr](cval) : cval;
						}
					} else {
						if (obj[cname]) {
							if (obj[cname].push) obj[cname].push( interpret(item) );
							else obj[cname] = [obj[cname], interpret(item)];
							continue;
						}
						cConstr = item.getAttribute('d:constr');
						switch (cConstr) {
							case 'null':
								if (obj.push) obj.push(null);
								else obj[cname] = null;
								break;
							case 'Array':
								//console.log( Defiant.node.prettyPrint(item) );
								if (item.parentNode.firstChild === item && cConstr === 'Array' && cname !== 'd:item') {
									if (cname === 'd:item' || cConstr === 'Array') {
										cval = interpret(item);
										obj[cname] = cval.length ? [cval] : cval;
									} else {
										obj[cname] = interpret(item);
									}
								}
								else if (obj.push) obj.push( interpret(item) );
								else obj[cname] = interpret(item);
								break;
							case 'String':
							case 'Number':
							case 'Boolean':
								text = item.textContent || item.text;
								cval = cConstr === 'Boolean' && text === 'false' ? '' : text;

								if (obj.push) obj.push( win[cConstr](cval) );
								else obj[cname] = interpret(item);
								break;
							default:
								if (obj.push) obj.push( interpret( item ) );
								else obj[cname] = interpret( item );
						}
					}
				}
			}
			if (leaf.nodeType === 1 && leaf.getAttribute('d:type') === 'ArrayItem') {
				obj = [obj];
			}
			return obj;
		},
		node = (xnode.nodeType === 9) ? xnode.documentElement : xnode,
		ret  = interpret(node),
		rn   = ret[node.nodeName];

	// exclude root, if "this" is root node
	if (node === node.ownerDocument.documentElement && rn && rn.constructor === Array) {
		ret = rn;
	}
	if (stringify && stringify.toString() === 'true') stringify = '\t';
	return stringify ? JSON.stringify(ret, null, stringify) : ret;
};


// check if jQuery is present
if (typeof(jQuery) !== 'undefined') {
	(function ( $ ) {
		'use strict';

		$.fn.defiant = function(template, xpath) {
			this.html( Defiant.render(template, xpath) );
			return this;
		};

	}(jQuery));
}