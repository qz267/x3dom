/*!
* x3dom javascript library 0.1
* http://www.x3dom.org/
*
* Copyright (c) 2009 Peter Eschler, Johannes Behr, Yvonne Jung
*     based on code originally provided by Philip Taylor:
*     http://philip.html5.org
* Dual licensed under the MIT and GPL licenses.
* 
*/

// the x3dom.nodes namespace
// x3dom.nodes = {};

/** @namespace the x3dom.nodeTypes namespace. */
x3dom.nodeTypes = {};

/** @namespace the x3dom.nodeTypesLC namespace. Stores nodetypes in lowercase */
x3dom.nodeTypesLC = {};

/** @namespace the x3dom.components namespace. */
x3dom.components = {};

/** Registers the node defined by @p nodeDef.

    The node is registered with the given @p nodeTypeName and @p componentName.
    
    @param nodeTypeName the name of the nodetype (e.g. Material, Shape, ...)
    @param componentName the name of the component the nodetype belongs to
    @param nodeDef the definition of the nodetype
 */
x3dom.registerNodeType = function(nodeTypeName, componentName, nodeDef) {
    x3dom.debug.logInfo("Registering nodetype [" + nodeTypeName + "] in component [" + componentName + "]");
    if (x3dom.components[componentName] === undefined) {
        x3dom.debug.logInfo("Adding new component [" + componentName + "]");
        x3dom.components[componentName] = {};
    }
    else {
        x3dom.debug.logInfo("Using component [" + componentName + "]");
	}
	nodeDef._typeName = nodeTypeName;
	nodeDef._compName = componentName;
    x3dom.components[componentName][nodeTypeName] = nodeDef;
    x3dom.nodeTypes[nodeTypeName] = nodeDef;
    x3dom.nodeTypesLC[nodeTypeName.toLowerCase()] = nodeDef;
};

x3dom.isX3DElement = function(node) {
    // x3dom.debug.logInfo("node=" + node + "node.nodeType=" + node.nodeType + ", node.localName=" + node.localName + ", ");
    return (node.nodeType === Node.ELEMENT_NODE && node.localName &&
        (x3dom.nodeTypes[node.localName] || x3dom.nodeTypesLC[node.localName.toLowerCase()] || node.localName.toLowerCase() === "x3d" || node.localName.toLowerCase() === "scene"  || node.localName.toLowerCase() === "route" ));
};

// BindableStack constructor
x3dom.BindableStack = function (type, defaultType, defaultRoot) {
	this.type = type;
	this.defaultType = type;
	this.defaultRoot = defaultRoot;
	this.bindBag = [];
	this.bindStack = [];
};

x3dom.BindableStack.prototype.getActive = function () {	
	if (this.bindStack.empty) {
		if (this.bindBag.empty) {
			var obj = new this.defaultType();
			this.defaultRoot.addChild(obj);
			obj.initDefault();
			this.bindBag.push(obj);
		}
		this.bindBag[0].activate();
		this.bindStack.push(this.bindBag[0]);
	}
	
	return this.bindStack[this.bindStack.length].top();
};

x3dom.BindableBag = function (defaultRoot) {
	this.addType ("X3DViewpointBindable", "Viewpoint", getViewpoint, defaultRoot );
	this.addType ("X3DNavigationInfoBindable", "NavigationInfo", getNavigationInfo, defaultRoot );
	this.addType ("X3DBackgroundBindable", "Background", getBackground, defaultRoot );
	this.addType ("X3DFogBindable", "Fog", getFog, defaultRoot);
};

x3dom.BindableBag.prototype.addType = function(typeName,defaultTypeName,getter,defaultRoot) {
	var type = x3dom.nodeTypes[typeName];
	var defaultType = x3dom.nodeTypes[defaultTypeName];
	var stack;
	
	if (type && defaultType) {
		stack = new x3dom.BindableStack (type, defaultType, defaultRoot);
		this[typeName] = this;
		this[getter] = function (stack) { return stack.getActive(); };
	}
	else {
	    x3dom.debug.logInfo ('Invalid Bindable type/defaultType:' + typeName + '/' + defaultType);
	}
};

// NodeNameSpace constructor
x3dom.NodeNameSpace = function (name) {
	this.name = name;
	this.defMap = {};
	this.parent = null;
	this.childSpaces = [];
};

x3dom.NodeNameSpace.prototype.addNode = function (node, name) {
	this.defMap[name] = node;
	node.nameSpace = this;
};

x3dom.NodeNameSpace.prototype.removeNode = function (name) {
	var node = this.defMap.name;
	delete this.defMap.name;
	if (node) {
		node.nameSpace = null;
	}
};

x3dom.NodeNameSpace.prototype.addSpace = function (space) {
	this.childSpaces.push(space);
	space.parent = this;
};

x3dom.NodeNameSpace.prototype.removeSpace = function (space) {
	this.childSpaces.push(space);
	space.parent = null;
};

// helper function to fire DOMAttrModifiedEvent
x3dom.fireDOMAttrModifiedEvent = function(attrName, newVal)
{
	var prevVal = this.getAttribute(attrName);
    this.__setAttribute(attrName, newVal);
	newVal = this.getAttribute(attrName);
        
    if (newVal != prevVal) {
		var evt = document.createEvent("MutationEvent");
     	evt.initMutationEvent(
              "DOMAttrModified",
              true,
              false,
              this,
              prevVal || "",
              newVal || "",
              attrName,
              (prevVal == null) ? evt.ADDITION : evt.MODIFICATION
        );
        this.dispatchEvent(evt);
     }
};

x3dom.NodeNameSpace.prototype.setupTree = function (domNode ) {
    var n, t;	
	
    if (x3dom.isX3DElement(domNode)) {
	
		//active workaground for missing DOMAttrModified support
		if ( (x3dom.userAgentFeature.supportsDOMAttrModified === false) &&
			 (domNode.tagName !== undefined) ) {
        	domNode.__setAttribute = domNode.setAttribute;
            domNode.setAttribute = x3dom.fireDOMAttrModifiedEvent;
		}
		
        // x3dom.debug.logInfo("=== node=" + domNode.localName);
	    if (domNode.hasAttribute('USE')) {
	      n = this.defMap[domNode.getAttribute('USE')];
	      if (n === null) 
	        x3dom.debug.logInfo ('Could not USE: ' + domNode.getAttribute('USE'));
	      return n;
	    }
	    else {
	 		// check and create ROUTEs
	    	if (domNode.localName.toLowerCase() === 'route') {
                var route = domNode;
                var fromNode = this.defMap[route.getAttribute('fromNode')];
                var toNode = this.defMap[route.getAttribute('toNode')];
                //x3dom.debug.logInfo("ROUTE: from=" + fromNode._DEF + ", to=" + toNode._DEF);
                if (! (fromNode && toNode)) {
                    x3dom.debug.logInfo("Broken route - can't find all DEFs for " + route.getAttribute('fromNode')+" -> "+ route.getAttribute('toNode'));
                    return null;
                }
                fromNode.setupRoute(route.getAttribute('fromField'), toNode, route.getAttribute('toField'));
//                 TODO: Store the routes of the scene - where should we store them?
//                 scene._routes = Array.map(sceneRoutes, setupRoute);
	    		return null;
            }
            
            // find the NodeType for the given dom-node          
            var nodeType = x3dom.nodeTypesLC[domNode.localName.toLowerCase()];
            if (nodeType === undefined) {                
                x3dom.debug.logInfo("Unrecognised element " + domNode.localName);
            }
            else {
                var ctx = { xmlNode: domNode };
                n = new nodeType(ctx);
				n._nameSpace = this;
				
                // x3dom.debug.logInfo("new node type: " + node.localName + ", autoChild=" + n._autoChild);
				
				// find and store/link _DEF name
			    if (domNode.hasAttribute('DEF')) {
			       n._DEF = domNode.getAttribute('DEF');
				   this.defMap[n._DEF] = n;
				}
				else {
				  if (domNode.hasAttribute('id')) {
					n._DEF = domNode.getAttribute('id');
					this.defMap[n._DEF] = n;
				  }
				}

				// link both DOM-Node and Scene-graph-Node
				n._xmlNode = domNode;
		        domNode._x3domNode = n;
                
				// call children
				/*
                Array.forEach( Array.map(domNode.childNodes, 
                                function (n) { return this.setupTree(n); }, this), 
                        		function (c) { if (c) n.addChild(c); });
                */
				var that = this;
                Array.forEach ( domNode.childNodes, function (childDomNode) { 
					var c = that.setupTree(childDomNode); 
					if (c) n.addChild(c, childDomNode.getAttribute("containerField")); 
				} );
								
				// FIXME: remove
				n.nodeChanged();
                return n;
            }
        }
    }
    else if (domNode.localName) {
        // be nice to users who use nodes not (yet) known to the system
        x3dom.debug.logInfo("Unrecognised element '" + domNode.localName + "'");
		n = null;
    }

	return n;
};


/** Utility function for defining a new class.

	@param parent the parent class of the new class
	@param ctor the constructor of the new class
	@param methods an object literal containing the methods of the new class
	@return the constructor function of the new class
  */
function defineClass(parent, ctor, methods) {
    if (parent) {
        function inheritance() {}
        inheritance.prototype = parent.prototype;
        ctor.prototype = new inheritance();
        ctor.prototype.constructor = ctor;
        ctor.superClass = parent;
    }
    if (methods) {
        for (var m in methods) {
            ctor.prototype[m] = methods[m];
        }
    }
    return ctor;
}

x3dom.isa = function(object, clazz) {
    if (object.constructor == clazz) {
        return true;
    }

    function f(c) {
        if (c == clazz) {
            return true;
        }
        if (c.prototype && c.prototype.constructor && c.prototype.constructor.superClass) {
            return f(c.prototype.constructor.superClass);
        }
        return false;
    }
    return f(object.constructor.superClass);
};

// X3D doesn't seem to define this decoding, so do something vaguely sensible instead...
function MFString_parse(str) {
    // TODO: ignore leading whitespace?
    if (str[0] == '"') {
        var re = /"((?:[^\\"]|\\\\|\\")*)"/g;
        var m;
        var ret = [];
        while ((m = re.exec(str))) {
            ret.push(m[1].replace(/\\([\\"])/, "$1"));
        }
        return ret;
    } else {
        return [str];
    }
};


// ### X3DNode ###
x3dom.registerNodeType("X3DNode", "Base", defineClass(null,
    function (ctx) {
		
		// holds a link to the node name
		this._DEF = null;
		
		// links the nameSpace
		this._nameSpace = null;
		
		// holds all value fields (e.g. SFFloat, MFVec3f, ...)
		this._vf = {};
		// holds all child fields ( SFNode and MFNode )
		this._cf = {};
		
        this._fieldWatchers = {};
        this._parentNodes = [];
        
		// FIXME; should be removed and handled by _cf methods
        this._childNodes = [];
    },
    {
        addChild: function (node, containerFieldName) {
			if (node) {
				var field = null;
				if (containerFieldName) {
					field = this._cf[containerFieldName];
				}
				else {
		    		for (var fieldName in this._cf) {
                		if (this._cf.hasOwnProperty(fieldName)) {
                    		var testField = this._cf[fieldName];
                    		if (x3dom.isa(node,testField.type)) {
								field = testField;
								break;
							}
						}
					}
				}
				if (field && field.addLink(node)) {
                    node._parentNodes.push(this);
                    this._childNodes.push(node);
                	return true;
            	}
			}
            return false;
        },
        
        removeChild: function (node) {
			if (node) {
	        	for (var fieldName in this._cf) {
                	if (this._cf.hasOwnProperty(fieldName)) {
                    	var field = this._cf[fieldName];
                    	if (field.rmLink(node)) {
                        	for (var i = 0, n = node._parentNodes.length; i < n; i++) {
                            	if (node._parentNode === this) {
                                	node._parentNodes.splice(i,1);
                            	} 
                        	}
							for (var j = 0, m = this._childNodes.length; j < m; j++) {			
                        		if (this._childNodes[j] === node) {
                             		this._childNodes.splice(j,1);
                                	return true;
								}
                         	}
                        }
                    }
                }
            }
            return false;
        },

        getCurrentTransform: function () {
            if (this._parentNodes.length >= 1) {
                return this.transformMatrix(this._parentNodes[0].getCurrentTransform());
            }
            else {
                return x3dom.fields.SFMatrix4f.identity();
            }
        },

        transformMatrix: function (transform) {
            return transform;
        },
		
		getVolume: function (min, max, invalidate) 
        {
            var valid = false;
			for (var i=0; i<this._childNodes.length; i++)
			{
				if (this._childNodes[i])
				{
                    var childMin = new x3dom.fields.SFVec3f(
                            Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
                    var childMax = new x3dom.fields.SFVec3f(
                            Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
					
					valid = this._childNodes[i].getVolume(
                                    childMin, childMax, invalidate) || valid;
					
                    if (valid)
                    {
                        if (min.x > childMin.x) { min.x = childMin.x; }
                        if (min.y > childMin.y) { min.y = childMin.y; }
                        if (min.z > childMin.z) { min.z = childMin.z; }
                            
                        if (max.x < childMax.x) { max.x = childMax.x; }
                        if (max.y < childMax.y) { max.y = childMax.y; }
                        if (max.z < childMax.z) { max.z = childMax.z; }
                    }
				}
			}
            return valid;
		},

        find: function (type) {
            for (var i=0; i<this._childNodes.length; i++) {
                if (this._childNodes[i]) {
                    if (this._childNodes[i].constructor == type) {
                        return this._childNodes[i];
                    }
                    var c = this._childNodes[i].find(type);
                    if (c) {
                        return c;
                    }
                }
            }
            return null;
        },

        findAll: function (type) {
            var found = [];
            for (var i=0; i<this._childNodes.length; i++) {
                if (this._childNodes[i]) {
                    if (this._childNodes[i].constructor == type) {
                        found.push(this._childNodes[i]);
                    }
                    // TODO: this has non-linear performance
                    found = found.concat(this._childNodes[i].findAll(type));
                }
            }
            return found;
        },

		findParentProperty: function (propertyName) {
			var value = this[propertyName];
			
			if (!value) {
				for (var i = 0, n = this._parentNodes.length; i < n; i++) {
					if ((value = this._parentNodes.findParentProperty(propertyName))) {
						break;
					}
				}
			}
			
			return value;
		},

        // Collects array of [transform matrix, node] for all objects that should be drawn.
        collectDrawableObjects: function (transform, out) {
            // TODO: culling etc.
            for (var i=0; i<this._childNodes.length; i++) {
                if (this._childNodes[i]) {
                    var childTransform = this._childNodes[i].transformMatrix(transform);
                    this._childNodes[i].collectDrawableObjects(childTransform, out);
                }
            }
        },
        
        doIntersect: function(line) {
            for (var i=0; i<this._childNodes.length; i++) {
                if (this._childNodes[i]) {
                    if (this._childNodes[i].doIntersect(line)) {
                        return true;
                    }
                }
            }
            return false;
        },

        postMessage: function (field, msg) {
            // TODO: timestamps and stuff
            var listeners = this._fieldWatchers[field];
            var thisp = this;
            if (listeners) {
                Array.forEach(listeners, function (l) { l.call(thisp, msg); });
            }
        },

        // method for handling field updates
        updateField: function (field, msg) {			
			var f = this._vf[field];
			
			if (f === undefined) {
				f = {};
				this._vf[field] = f;
			}
			
            if (f !== null) {
                try {
                    this._vf[field].setValueByStr(msg);
                }
                catch (exc) {
                    x3dom.debug.logInfo("updateField: setValueByStr() NYI for " + typeof(f));
                }
                
                // TODO: eval fieldChanged for all nodes!
                this.fieldChanged(field);
            }
        },

        setupRoute: function (fromField, toNode, toField) {
			var pos;
			var fieldName;
			var pre = "set_", post = "_changed";
            
			// build correct fromField
			if (!this._vf[fromField]) {
				pos = fromField.indexOf(pre);
				if (pos === 0) {
					fieldName = fromField.substr(pre.length, fromField.length - 1);
					if (this._vf[fieldName]) 
						fromField = fieldName;
				}
                else {
					pos = fromField.indexOf(post);
					if (pos > 0) {
						fieldName = fromField.substr(0, fromField.length - post.length);
						if (this._vf[fieldName]) 
							fromField = fieldName;
					}
				}
			}
			
			// build correct toField
			if (!toNode._vf[toField]) {
				pos = toField.indexOf(pre);
				if (pos === 0) {
					fieldName = toField.substr(pre.length, toField.length - 1);
					if (toNode._vf[fieldName]) 
						toField = fieldName;
				}
                else {
					pos = toField.indexOf(post);
					if (pos > 0) {
						fieldName = toField.substr(0, toField.length - post.length);
						if (toNode._vf[fieldName]) 
							toField = fieldName;
					}
				}
			}
            
         
            if (! this._fieldWatchers[fromField]) {
                this._fieldWatchers[fromField] = [];
            }
            this._fieldWatchers[fromField].push(
                function (msg) { 
                    toNode.postMessage(toField, msg); 
                }
            );
            
            if (! toNode._fieldWatchers[toField]) {
               	toNode._fieldWatchers[toField] = [];
           	}
            toNode._fieldWatchers[toField].push(
                function (msg) {
                    // FIXME: THIS DOESN'T WORK FOR NODE (_cf) FIELDS
                    toNode._vf[toField] = msg;
                    
                    toNode.fieldChanged(toField);
                }
            );
        },
        
        fieldChanged: function (fieldName) {
            // to be overwritten by concrete classes
        },
        
		nodeChanged: function () {
			// to be overwritten by concrete classes
		},
        
		addField_SFInt32: function (ctx, name, n) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                parseInt(ctx.xmlNode.getAttribute(name),10) : n;
            this._vf[name].setValueByStr = function(str) {
                this._vf[name] = parseInt(str,10);
            };
        },
        addField_SFFloat: function (ctx, name, n) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                +ctx.xmlNode.getAttribute(name) : n;
            this._vf[name].setValueByStr = function(str) {
                this._vf[name] = +str;
            };
        },
        addField_SFTime: function (ctx, name, n) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                +ctx.xmlNode.getAttribute(name) : n;
            this._vf[name].setValueByStr = function(str) {
                this._vf[name] = +str;
            };
        },
        addField_SFBool: function (ctx, name, n) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                ctx.xmlNode.getAttribute(name).toLowerCase() === "true" : n;
            this._vf[name].setValueByStr = function(str) {
                this._vf[name] = (str.toLowerCase() === "true");
            };
        },
        addField_SFString: function (ctx, name, n) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                ctx.xmlNode.getAttribute(name) : n;
            this._vf[name].setValueByStr = function(str) {
                this._vf[name] = str;
            };
        },
        addField_SFColor: function (ctx, name, r, g, b) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                x3dom.fields.SFColor.parse(ctx.xmlNode.getAttribute(name)) : 
                new x3dom.fields.SFColor(r, g, b);
        },
        addField_SFVec2f: function (ctx, name, x, y) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                x3dom.fields.SFVec2f.parse(ctx.xmlNode.getAttribute(name)) : 
                new x3dom.fields.SFVec2f(x, y);
        },
        addField_SFVec3f: function (ctx, name, x, y, z) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                x3dom.fields.SFVec3f.parse(ctx.xmlNode.getAttribute(name)) : 
                new x3dom.fields.SFVec3f(x, y, z);
        },
        addField_SFRotation: function (ctx, name, x, y, z, a) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                x3dom.fields.Quaternion.parseAxisAngle(ctx.xmlNode.getAttribute(name)) : 
                new x3dom.fields.Quaternion(x, y, z, a);
        },
        addField_SFMatrix4f: function (ctx, name, _00, _01, _02, _03, 
                                                    _10, _11, _12, _13, 
                                                    _20, _21, _22, _23, 
                                                    _30, _31, _32, _33) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                x3dom.fields.SFMatrix4f.parse(ctx.xmlNode.getAttribute(name)) : 
                new x3dom.fields.SFMatrix4f(_00, _01, _02, _03, 
                                            _10, _11, _12, _13, 
                                            _20, _21, _22, _23, 
                                            _30, _31, _32, _33);
        },
        
        addField_MFString: function (ctx, name, def) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                MFString_parse(ctx.xmlNode.getAttribute(name)) : def;
            this._vf[name].setValueByStr = function(str) {
                this._vf[name] = MFString_parse(str);
            };
        },
        addField_MFInt32: function (ctx, name, def) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                x3dom.fields.MFInt32.parse(ctx.xmlNode.getAttribute(name)) : 
                new x3dom.fields.MFInt32(def);
        },
        addField_MFFloat: function (ctx, name, def) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                x3dom.fields.MFFloat.parse(ctx.xmlNode.getAttribute(name)) : 
                new x3dom.fields.MFFloat(def);
        },
        addField_MFColor: function (ctx, name, def) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                x3dom.fields.MFColor.parse(ctx.xmlNode.getAttribute(name)) : 
                new x3dom.fields.MFColor(def);
        },
        addField_MFVec2f: function (ctx, name, def) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                x3dom.fields.MFVec2f.parse(ctx.xmlNode.getAttribute(name)) : 
                new x3dom.fields.MFVec2f(def);
        },
        addField_MFVec3f: function (ctx, name, def) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                x3dom.fields.MFVec3f.parse(ctx.xmlNode.getAttribute(name)) : 
                new x3dom.fields.MFVec3f(def);
        },
        addField_MFRotation: function (ctx, name, def) {
            this._vf[name] = ctx && ctx.xmlNode.hasAttribute(name) ? 
                x3dom.fields.MFRotation.parse(ctx.xmlNode.getAttribute(name)) : 
                new x3dom.fields.MFRotation(def);
        },
        
		addField_SFNode: function (name, type) {
			this._cf[name] = new x3dom.fields.SFNode(type);
		},
		addField_MFNode: function (name, type) {
			this._cf[name] = new x3dom.fields.MFNode(type);
		}
    }
));

/* ### X3DAppearanceNode ### */
x3dom.registerNodeType(
    "X3DAppearanceNode", 
    "Base", 
    defineClass(x3dom.nodeTypes.X3DNode,
        function (ctx) {
            x3dom.nodeTypes.X3DAppearanceNode.superClass.call(this, ctx);
        }
    )
);

/* ### Appearance ### */	
x3dom.registerNodeType(
    "Appearance", 
    "Shape", 
    defineClass(x3dom.nodeTypes.X3DAppearanceNode,        
        function (ctx) {
            x3dom.nodeTypes.Appearance.superClass.call(this, ctx);
            
            this.addField_SFNode('material', x3dom.nodeTypes.X3DMaterialNode);
            this.addField_SFNode('texture',  x3dom.nodeTypes.X3DTextureNode);	
            this.addField_SFNode('textureTransform', x3dom.nodeTypes.X3DTextureTransformNode);
            this.addField_MFNode('shaders', x3dom.nodeTypes.X3DShaderNode);
            
            // shortcut to shader program
            this._shader = null;
		},
		{
			nodeChanged: function() { 		
				if (!this._cf.material.node) {					
					this.addChild(x3dom.nodeTypes.Material.defaultNode());
				}
                
                if (this._cf.shaders.nodes.length) {
                    this._shader = this._cf.shaders.nodes[0];
                }
        	},
            
            transformMatrix: function() {
                if (this._cf.textureTransform.node === null) {
                    return x3dom.fields.SFMatrix4f.identity();
                }
                else {
                    return this._cf.textureTransform.node.transformMatrix();
                }
            }
		}
    )
);

x3dom.nodeTypes.Appearance.defaultNode = function() {
	if (!x3dom.nodeTypes.Appearance._defaultNode) {
		x3dom.nodeTypes.Appearance._defaultNode = new x3dom.nodeTypes.Appearance();
        x3dom.nodeTypes.Appearance._defaultNode.nodeChanged();
	}
	return x3dom.nodeTypes.Appearance._defaultNode;
};

/* ### X3DAppearanceChildNode ### */
x3dom.registerNodeType(
    "X3DAppearanceChildNode", 
    "Base", 
    defineClass(x3dom.nodeTypes.X3DNode,
        function (ctx) {
            x3dom.nodeTypes.X3DAppearanceChildNode.superClass.call(this, ctx);
        }
    )
);

/* ### X3DMaterialNode ### */
x3dom.registerNodeType(
    "X3DMaterialNode",
    "Base",
    defineClass(x3dom.nodeTypes.X3DAppearanceChildNode,
        function (ctx) {
            x3dom.nodeTypes.X3DMaterialNode.superClass.call(this, ctx);
        }
    )
);

/* ### Material ### */
x3dom.registerNodeType(
    "Material",
    "Shape",
    defineClass(x3dom.nodeTypes.X3DMaterialNode,
        function (ctx) {
            x3dom.nodeTypes.Material.superClass.call(this, ctx);
    
            this.addField_SFFloat(ctx, 'ambientIntensity', 0.2);
            this.addField_SFColor(ctx, 'diffuseColor', 0.8, 0.8, 0.8);
            this.addField_SFColor(ctx, 'emissiveColor', 0, 0, 0);
            this.addField_SFFloat(ctx, 'shininess', 0.2);
            this.addField_SFColor(ctx, 'specularColor', 0, 0, 0);
            this.addField_SFFloat(ctx, 'transparency', 0);
        }
    )
);

x3dom.nodeTypes.Material.defaultNode = function() {
	if (!x3dom.nodeTypes.Material._defaultNode) {
		x3dom.nodeTypes.Material._defaultNode = new x3dom.nodeTypes.Material();
        x3dom.nodeTypes.Material._defaultNode.nodeChanged();
	}
	return x3dom.nodeTypes.Material._defaultNode;
};

/* ### X3DTextureTransformNode ### */
x3dom.registerNodeType(
    "X3DTextureTransformNode",
    "Texturing",
    defineClass(x3dom.nodeTypes.X3DAppearanceChildNode,
        function (ctx) {
            x3dom.nodeTypes.X3DTextureTransformNode.superClass.call(this, ctx);
        }
    )
);

/* ### TextureTransform ### */
x3dom.registerNodeType(
    "TextureTransform",
    "Texturing",
    defineClass(x3dom.nodeTypes.X3DTextureTransformNode,
        function (ctx) {
            x3dom.nodeTypes.TextureTransform.superClass.call(this, ctx);
			
			this.addField_SFVec2f(ctx, 'center', 0, 0);
            this.addField_SFFloat(ctx, 'rotation', 0);
            this.addField_SFVec2f(ctx, 'scale', 1, 1);
            this.addField_SFVec2f(ctx, 'translation', 0, 0);
            
            //Tc' = -C * S * R * C * T * Tc
            var negCenter = new x3dom.fields.SFVec3f(-this._vf.center.x, -this._vf.center.y, 1);
            var posCenter = new x3dom.fields.SFVec3f(this._vf.center.x, this._vf.center.y, 0);
            var trans3 = new x3dom.fields.SFVec3f(this._vf.translation.x, this._vf.translation.y, 0);
            var scale3 = new x3dom.fields.SFVec3f(this._vf.scale.x, this._vf.scale.y, 0);
            
            this._trafo = x3dom.fields.SFMatrix4f.translation(negCenter).
                    mult(x3dom.fields.SFMatrix4f.scale(scale3)).
                    mult(x3dom.fields.SFMatrix4f.rotationZ(this._vf.rotation)).
                    mult(x3dom.fields.SFMatrix4f.translation(posCenter)).
                    mult(x3dom.fields.SFMatrix4f.translation(trans3));
        },
        {
            fieldChanged: function (fieldName) {
	            //Tc' = -C * S * R * C * T * Tc
                var negCenter = new x3dom.fields.SFVec3f(-this._vf.center.x, -this._vf.center.y, 1);
                var posCenter = new x3dom.fields.SFVec3f(this._vf.center.x, this._vf.center.y, 0);
                var trans3 = new x3dom.fields.SFVec3f(this._vf.translation.x, this._vf.translation.y, 0);
                var scale3 = new x3dom.fields.SFVec3f(this._vf.scale.x, this._vf.scale.y, 0);
                
                this._trafo = x3dom.fields.SFMatrix4f.translation(negCenter).
                         mult(x3dom.fields.SFMatrix4f.scale(scale3)).
                         mult(x3dom.fields.SFMatrix4f.rotationZ(this._vf.rotation)).
                         mult(x3dom.fields.SFMatrix4f.translation(posCenter)).
                         mult(x3dom.fields.SFMatrix4f.translation(trans3));
            },
            
            transformMatrix: function() {
                return this._trafo;
            }
        }
    )
);

/* ### X3DTextureNode ### */
x3dom.registerNodeType(
    "X3DTextureNode",
    "Texturing",
    defineClass(x3dom.nodeTypes.X3DAppearanceChildNode,
        function (ctx) {
            x3dom.nodeTypes.X3DTextureNode.superClass.call(this, ctx);
            
            this.addField_MFString(ctx, 'url', []);
            this.addField_SFBool(ctx, 'repeatS', true);
            this.addField_SFBool(ctx, 'repeatT', true);
        }
    )
);

/* ### ImageTexture ### */
x3dom.registerNodeType(
    "ImageTexture",
    "Texturing",
    defineClass(x3dom.nodeTypes.X3DTextureNode,
        function (ctx) {
            x3dom.nodeTypes.ImageTexture.superClass.call(this, ctx);
        },
        {
            fieldChanged: function (fieldName) {
                // FIXME: Add texture url update code (also in gfx)
            }
        }
    )
);

/* ### MovieTexture ### */
x3dom.registerNodeType(
    "MovieTexture",
    "Texturing",
    defineClass(x3dom.nodeTypes.X3DTextureNode,
        function (ctx) {
            x3dom.nodeTypes.MovieTexture.superClass.call(this, ctx);
			
            this.addField_SFBool(ctx, 'loop', false);
            this.addField_SFFloat(ctx, 'speed', 1.0);
            
            this._video = null;
            this._intervalID = 0;
        },
        {
            fieldChanged: function (fieldName) {
                // FIXME: Add texture url update code (also in gfx)
            }
        }
    )
);

/* ### X3DShaderNode ### */
x3dom.registerNodeType(
    "X3DShaderNode",
    "Shaders",
    defineClass(x3dom.nodeTypes.X3DAppearanceChildNode,
        function (ctx) {
            x3dom.nodeTypes.X3DShaderNode.superClass.call(this, ctx);
            
            this.addField_SFString(ctx, 'language', "");
        }
    )
);

/* ### ComposedShader ### */
x3dom.registerNodeType(
    "ComposedShader",
    "Shaders",
    defineClass(x3dom.nodeTypes.X3DShaderNode,
        function (ctx) {
            x3dom.nodeTypes.ComposedShader.superClass.call(this, ctx);
            
            this.addField_MFNode('parts', x3dom.nodeTypes.ShaderPart);
            
            // shortcut to shader parts
            this._vertex = null;
            this._fragment = null;
            
            x3dom.debug.logInfo("ComposedShader node implementation limitations:\n" +
                    "Vertex attributes, matrices and texture are provided as follows\n" +
                    "    attribute vec3 position;\n" +
                    "    attribute vec3 normal;\n" +
                    "    attribute vec2 texcoord;\n" +
                    "    attribute vec3 color;\n" +
                    "    uniform mat4 modelViewProjectionMatrix;\n" +
                    "    uniform mat4 modelViewMatrix;\n" +
                    "    uniform sampler2D tex;\n" +
                    "Please note, that comments in shaders will lead to parsing errors, " +
                    "furthermore, dynamic fields are not yet supported, and finally, " +
                    "'&lt;' and '&gt;' symbols currently cannot be parsed either.\n");
        },
        {
            nodeChanged: function()
            {
                var i, n = this._cf.parts.nodes.length;
                
                for (i=0; i<n; i++)
                {
                    if (this._cf.parts.nodes[i]._vf.type.toLowerCase() == 'vertex') {
                        this._vertex = this._cf.parts.nodes[i];
                    }
                    else if (this._cf.parts.nodes[i]._vf.type.toLowerCase() == 'fragment') {
                        this._fragment = this._cf.parts.nodes[i];
                    }
                }
            }
        }
    )
);

/* ### ShaderPart ### */
x3dom.registerNodeType(
    "ShaderPart",
    "Shaders",
    defineClass(x3dom.nodeTypes.X3DNode,
        function (ctx) {
            x3dom.nodeTypes.ShaderPart.superClass.call(this, ctx);
            
            this.addField_MFString(ctx, 'url', []);
            this.addField_SFString(ctx, 'type', "VERTEX");
            
            x3dom.debug.assert(this._vf.type.toLowerCase() == 'vertex' ||
                               this._vf.type.toLowerCase() == 'fragment');
        },
        {
        }
    )
);


// MESH in extern js

/** @class x3dom.Mesh
*/
x3dom.Mesh = function(parent) 
{
    this._parent = parent;
	this._min = new x3dom.fields.SFVec3f(0,0,0);
	this._max = new x3dom.fields.SFVec3f(0,0,0);
	this._invalidate = true;
};

x3dom.Mesh.prototype._positions = [];
x3dom.Mesh.prototype._normals   = [];
x3dom.Mesh.prototype._texCoords = [];
x3dom.Mesh.prototype._colors    = [];
x3dom.Mesh.prototype._indices   = [];

x3dom.Mesh.prototype._lit = true;
x3dom.Mesh.prototype._min = {};
x3dom.Mesh.prototype._max = {};
x3dom.Mesh.prototype._invalidate = true;

x3dom.Mesh.prototype.getBBox = function(min, max, invalidate)
{
	if (this._invalidate === true && invalidate === true)	//need both?
	{
		var coords = this._positions;
		var n = coords.length;
		
		if (n > 3)
		{
			this._min = new x3dom.fields.SFVec3f(coords[0],coords[1],coords[2]);
			this._max = new x3dom.fields.SFVec3f(coords[0],coords[1],coords[2]);
		}
		else
		{
			this._min = new x3dom.fields.SFVec3f(0,0,0);
			this._max = new x3dom.fields.SFVec3f(0,0,0);
		}
		
		for (var i=3; i<n; i+=3)
		{
			if (this._min.x > coords[i+0]) { this._min.x = coords[i+0]; }
			if (this._min.y > coords[i+1]) { this._min.y = coords[i+1]; }
			if (this._min.z > coords[i+2]) { this._min.z = coords[i+2]; }
			
			if (this._max.x < coords[i+0]) { this._max.x = coords[i+0]; }
			if (this._max.y < coords[i+1]) { this._max.y = coords[i+1]; }
			if (this._max.z < coords[i+2]) { this._max.z = coords[i+2]; }
		}
		
		this._invalidate = false;
	}
	
	min.x = this._min.x;
	min.y = this._min.y;
	min.z = this._min.z;
	
	max.x = this._max.x;
	max.y = this._max.y;
	max.z = this._max.z;
};

x3dom.Mesh.prototype.getCenter = function() 
{
	var min = new x3dom.fields.SFVec3f(0,0,0);
	var max = new x3dom.fields.SFVec3f(0,0,0);
	
	this.getBBox(min, max, true);
	
	var center = min.add(max).multiply(0.5);
	//x3dom.debug.logInfo("getCenter: " + min + " | " + max + " --> " + center);
	
	return center;
};

x3dom.Mesh.prototype.doIntersect = function(line)
{
	var min = new x3dom.fields.SFVec3f(0,0,0);
	var max = new x3dom.fields.SFVec3f(0,0,0);
	
	this.getBBox(min, max, true);
    
    var isect = line.intersect(min, max);
    
    //TODO: check for _nearest_ hit object and iterate over all faces!
    line.hit = isect;
    
    if (isect)
    {
        x3dom.debug.logInfo("Hit \"" + this._parent._xmlNode.localName + "/ " + this._parent._DEF + "\"");
        
        line.hitObject = this._parent;
        line.hitPoint = line.pos.add(line.dir.multiply(line.enter));
    }
    
    return isect;
};

x3dom.Mesh.prototype.calcNormals = function(creaseAngle)
{
    var i = 0, j = 0, num = 0;
    var multInd = (this._multiIndIndices !== undefined && this._multiIndIndices.length);
	var coords = this._positions;
	var idxs = multInd ? this._multiIndIndices : this._indices;
	
	var vertNormals = [];
	var vertFaceNormals = [];

    var a, b, n = null;
    
    num = coords.length / 3;
	
	for (i = 0; i < num; ++i) {
		vertFaceNormals[i] = [];
    }
    
    num = idxs.length;

	for (i = 0; i < num; i += 3) {
        if (!multInd) {
            a = new x3dom.fields.SFVec3f(
                    coords[idxs[i  ]*3], coords[idxs[i  ]*3+1], coords[idxs[i  ]*3+2]).
                subtract(new x3dom.fields.SFVec3f(
                    coords[idxs[i+1]*3], coords[idxs[i+1]*3+1], coords[idxs[i+1]*3+2]));
            b = new x3dom.fields.SFVec3f(
                    coords[idxs[i+1]*3], coords[idxs[i+1]*3+1], coords[idxs[i+1]*3+2]).
                subtract(new x3dom.fields.SFVec3f(
                    coords[idxs[i+2]*3], coords[idxs[i+2]*3+1], coords[idxs[i+2]*3+2]));
        }
        else {
            a = new x3dom.fields.SFVec3f(
                        coords[i*3], coords[i*3+1], coords[i*3+2]).
                    subtract(new x3dom.fields.SFVec3f(
                        coords[(i+1)*3], coords[(i+1)*3+1], coords[(i+1)*3+2]));
            b = new x3dom.fields.SFVec3f(
                        coords[(i+1)*3], coords[(i+1)*3+1], coords[(i+1)*3+2]).
                    subtract(new x3dom.fields.SFVec3f(
                        coords[(i+2)*3], coords[(i+2)*3+1], coords[(i+2)*3+2]));
        }
		
		n = a.cross(b).normalize();
		vertFaceNormals[idxs[i  ]].push(n);
		vertFaceNormals[idxs[i+1]].push(n);
		vertFaceNormals[idxs[i+2]].push(n);
	}
    
    for (i = 0; i < coords.length; i += 3) {
        //TODO: creaseAngle
		n = new x3dom.fields.SFVec3f(0, 0, 0);
        
        if (!multInd) {
            num = vertFaceNormals[i/3].length;
            for (j = 0; j < num; ++j) {
                n = n.add(vertFaceNormals[i/3][j]);
            }
        }
        else {
            num = vertFaceNormals[idxs[i/3]].length;
            for (j = 0; j < num; ++j) {
                n = n.add(vertFaceNormals[idxs[i/3]][j]);
            }
        }

		n = n.normalize();
		vertNormals[i  ] = n.x;
		vertNormals[i+1] = n.y;
		vertNormals[i+2] = n.z;
	}
    
    if (multInd) {
        this._multiIndIndices = [];
    }
	
	this._normals = vertNormals;
};

x3dom.Mesh.prototype.calcTexCoords = function()
{
	//TODO
};

x3dom.Mesh.prototype.remapData = function()
{
	//x3dom.debug.logInfo("Indices:   "+this._indices);
	//x3dom.debug.logInfo("Positions: "+this._positions);
};


/* ### X3DGeometryNode ### */
x3dom.registerNodeType(
    "X3DGeometryNode",
    "Base",
    defineClass(x3dom.nodeTypes.X3DNode,
        function (ctx) {
            x3dom.nodeTypes.X3DGeometryNode.superClass.call(this, ctx);
			
			this.addField_SFBool(ctx, 'solid', true);
            this.addField_SFBool(ctx, 'ccw', true);
			
			this._mesh = new x3dom.Mesh(this);
        },
		{
			getVolume: function(min, max, invalidate) {
				this._mesh.getBBox(min, max, invalidate);
                return true;
			},
			
			getCenter: function() {
				return this._mesh.getCenter();
			},
            
            doIntersect: function(line) {
                var isect = this._mesh.doIntersect(line);
				
				if (isect && this._xmlNode !== null) {
					if (this._xmlNode.hasAttribute('onclick'))
					{
						var funcStr = this._xmlNode.getAttribute('onclick');
						var func = new Function('hitPnt', funcStr);
						func.call(this, line.hitPoint);
					}
				}
				
                return isect;
            }
		}
    )
);

/* ### Box ### */
x3dom.registerNodeType(
    "Box",
    "Geometry3D",
    defineClass(x3dom.nodeTypes.X3DGeometryNode,
        function (ctx) {
            x3dom.nodeTypes.Box.superClass.call(this, ctx);
    
            var sx, sy, sz;
            if (ctx.xmlNode.hasAttribute('size')) {
                var size = x3dom.fields.SFVec3f.parse(ctx.xmlNode.getAttribute('size'));
                sx = size.x;
                sy = size.y;
                sz = size.z;
            } else {
                sx = sy = sz = 2;
            }
    
            sx /= 2; sy /= 2; sz /= 2;
			
            this._mesh._positions = [
                -sx,-sy,-sz,  -sx, sy,-sz,   sx, sy,-sz,   sx,-sy,-sz, //hinten 0,0,-1
                -sx,-sy, sz,  -sx, sy, sz,   sx, sy, sz,   sx,-sy, sz, //vorne 0,0,1
                -sx,-sy,-sz,  -sx,-sy, sz,  -sx, sy, sz,  -sx, sy,-sz, //links -1,0,0
                 sx,-sy,-sz,   sx,-sy, sz,   sx, sy, sz,   sx, sy,-sz, //rechts 1,0,0
                -sx, sy,-sz,  -sx, sy, sz,   sx, sy, sz,   sx, sy,-sz, //oben 0,1,0
                -sx,-sy,-sz,  -sx,-sy, sz,   sx,-sy, sz,   sx,-sy,-sz  //unten 0,-1,0
            ];
			this._mesh._normals = [
                0,0,-1,  0,0,-1,   0,0,-1,   0,0,-1,
                0,0,1,  0,0,1,   0,0,1,   0,0,1,
                -1,0,0,  -1,0,0,  -1,0,0,  -1,0,0,
                1,0,0,   1,0,0,   1,0,0,   1,0,0,
                0,1,0,  0,1,0,   0,1,0,   0,1,0,
                0,-1,0,  0,-1,0,   0,-1,0,   0,-1,0
            ];
			this._mesh._texCoords = [
				1,0, 1,1, 0,1, 0,0, 
				0,0, 0,1, 1,1, 1,0, 
				0,0, 1,0, 1,1, 0,1, 
				1,0, 0,0, 0,1, 1,1, 
				0,1, 0,0, 1,0, 1,1, 
				0,0, 0,1, 1,1, 1,0
			];
            this._mesh._indices = [
                0,1,2, 2,3,0,
                4,7,5, 5,7,6,
                8,9,10, 10,11,8,
                12,14,13, 14,12,15,
                16,17,18, 18,19,16,
                20,22,21, 22,20,23
            ];
			this._mesh._invalidate = true;
        }
    )
);

/* ### Sphere ### */
x3dom.registerNodeType(
    "Sphere",
    "Geometry3D",
    defineClass(x3dom.nodeTypes.X3DGeometryNode,
        function (ctx) {
            x3dom.nodeTypes.Sphere.superClass.call(this, ctx);
    
            var r = ctx ? 1 : 10000;
            if (ctx && ctx.xmlNode.hasAttribute('radius')) {
                r = +ctx.xmlNode.getAttribute('radius');
            }
            
            this._mesh._indices = [];
            this._mesh._positions = [];
            this._mesh._normals = [];
            this._mesh._texCoords = [];
            this._mesh._colors = [];
            
            var latNumber, longNumber;
            var latitudeBands = 24;
            var longitudeBands = 24;
            
            var theta, sinTheta, cosTheta;
            var phi, sinPhi, cosPhi;
            var x, y, z, u, v;
            
            for (latNumber = 0; latNumber <= latitudeBands; latNumber++)
            {
                theta = (latNumber * Math.PI) / latitudeBands;
                sinTheta = Math.sin(theta);
                cosTheta = Math.cos(theta);

                for (longNumber = 0; longNumber <= longitudeBands; longNumber++)
                {
                    phi = (longNumber * 2.0 * Math.PI) / longitudeBands;
                    sinPhi = Math.sin(phi);
                    cosPhi = Math.cos(phi);

                    x = -cosPhi * sinTheta;
                    y = -cosTheta;
                    z = -sinPhi * sinTheta;
                    
                    u = 0.25 - ((1.0 * longNumber) / longitudeBands);
                    v = latNumber / latitudeBands;
                    
                    this._mesh._positions.push(r * x);
                    this._mesh._positions.push(r * y);
                    this._mesh._positions.push(r * z);
                    this._mesh._normals.push(x);
                    this._mesh._normals.push(y);
                    this._mesh._normals.push(z);
                    this._mesh._texCoords.push(u);
                    this._mesh._texCoords.push(v);
                }
            }
            
            var first, second;
            
            for (latNumber = 0; latNumber < latitudeBands; latNumber++)
            {
                for (longNumber = 0; longNumber < longitudeBands; longNumber++)
                {
                    first = (latNumber * (longitudeBands + 1)) + longNumber;
                    second = first + longitudeBands + 1;
                    
                    this._mesh._indices.push(first);
                    this._mesh._indices.push(second);
                    this._mesh._indices.push(first + 1);

                    this._mesh._indices.push(second);
                    this._mesh._indices.push(second + 1);
                    this._mesh._indices.push(first + 1);
                }
            }
            
            this._mesh._invalidate = true;
        }
    )
);

/* ### Torus ### */
x3dom.registerNodeType(
    "Torus",
    "Geometry3D",
    defineClass(x3dom.nodeTypes.X3DGeometryNode,
        function (ctx) {
            x3dom.nodeTypes.Torus.superClass.call(this, ctx);
    
            var innerRadius = 0.5, outerRadius = 1.0;
			
            if (ctx.xmlNode.hasAttribute('innerRadius')) {
                innerRadius = +ctx.xmlNode.getAttribute('innerRadius');
            }
            if (ctx.xmlNode.hasAttribute('outerRadius')) {
                outerRadius = +ctx.xmlNode.getAttribute('outerRadius');
            }
			
			var rings = 24, sides = 24;
			var ringDelta = 2.0 * Math.PI / rings;
			var sideDelta = 2.0 * Math.PI / sides;
			var p = [], n = [], t = [], i = [];
            var a, b, theta, phi;

			for (a=0, theta=0; a <= rings; a++, theta+=ringDelta) 
			{
				var cosTheta = Math.cos(theta);
				var sinTheta = Math.sin(theta);

				for (b=0, phi=0; b<=sides; b++, phi+=sideDelta) 
				{
					var cosPhi = Math.cos(phi);
					var sinPhi = Math.sin(phi);
					var dist = outerRadius + innerRadius * cosPhi;

					n.push(cosTheta * cosPhi, -sinTheta * cosPhi, sinPhi);
					p.push(cosTheta * dist, -sinTheta * dist, innerRadius * sinPhi);
					t.push(-a / rings, b / sides);
				}
			}
			
			for (a=0; a<sides; a++) 
			{
				for (b=0; b<rings; b++)
				{
					i.push(b * (sides+1) + a);
					i.push(b * (sides+1) + a + 1);
					i.push((b + 1) * (sides+1) + a);
					
					i.push(b * (sides+1) + a + 1);
					i.push((b + 1) * (sides+1) + a + 1);
					i.push((b + 1) * (sides+1) + a);
				}
			}
			
            this._mesh._positions = p;
			this._mesh._normals = n;
			this._mesh._texCoords = t;
            this._mesh._indices = i;
			this._mesh._invalidate = true;
        }
    )
);

/* ### Cone ### */
x3dom.registerNodeType(
    "Cone",
    "Geometry3D",
    defineClass(x3dom.nodeTypes.X3DGeometryNode,
        function (ctx) {
            x3dom.nodeTypes.Cone.superClass.call(this, ctx);
    
            var bottomRadius = 1.0, height = 2.0;
			
            if (ctx.xmlNode.hasAttribute('bottomRadius')) {
                bottomRadius = +ctx.xmlNode.getAttribute('bottomRadius');
            }
            if (ctx.xmlNode.hasAttribute('height')) {
                height = +ctx.xmlNode.getAttribute('height');
            }
			
            var beta, x, z;
			var sides = 32;
			var delta = 2.0 * Math.PI / sides;
			var incl = bottomRadius / height;
			var nlen = 1.0 / Math.sqrt(1.0 + incl * incl);
			var p = [], n = [], t = [], i = [];
			
			for (var j=0, k=0; j<=sides; j++)
			{
				beta = j * delta;
				x = Math.sin(beta);
				z = -Math.cos(beta);         

				p.push(0, height/2, 0);
				n.push(x/nlen, incl/nlen, z/nlen);
				t.push(1.0 - j / sides, 1);

				p.push(x * bottomRadius, -height/2, z * bottomRadius);
				n.push(x/nlen, incl/nlen, z/nlen);
				t.push(1.0 - j / sides, 0);
				
				if (j > 0)
				{
					i.push(k + 0);
					i.push(k + 2);
					i.push(k + 1);
					
					i.push(k + 1);
					i.push(k + 2);
					i.push(k + 3);
					
					k += 2;
				}
			}
			
			if (bottomRadius > 0)
			{
				var base = p.length / 3;
				
				for (j=sides-1; j>=0; j--)
				{
					beta = j * delta;
					x = bottomRadius * Math.sin(beta);
					z = -bottomRadius * Math.cos(beta); 

					p.push(x, -height/2, z);
					n.push(0, -1, 0);
					t.push(x / bottomRadius / 2 + 0.5, z / bottomRadius / 2 + 0.5);
				}
				
				var h = base + 1;
				
				for (j=2; j<sides; j++) 
				{
					i.push(h);
					i.push(base);
					
					h = base + j;
					i.push(h);
				}
			}
			
			this._mesh._positions = p;
			this._mesh._normals = n;
			this._mesh._texCoords = t;
            this._mesh._indices = i;
			this._mesh._invalidate = true;
        }
    )
);

/* ### Cylinder ### */
x3dom.registerNodeType(
    "Cylinder",
    "Geometry3D",
    defineClass(x3dom.nodeTypes.X3DGeometryNode,
        function (ctx) {
            x3dom.nodeTypes.Cylinder.superClass.call(this, ctx);
    
            var radius = 1.0, height = 2.0;
			
            if (ctx.xmlNode.hasAttribute('radius')) {
                radius = +ctx.xmlNode.getAttribute('radius');
            }
            if (ctx.xmlNode.hasAttribute('height')) {
                height = +ctx.xmlNode.getAttribute('height');
			}

            var beta, x, z;
			var sides = 24;
			var delta = 2.0 * Math.PI / sides;
			var p = [], n = [], t = [], i = [];
			
			for (var j=0, k=0; j<=sides; j++)
			{
				beta = j * delta;
				x = Math.sin(beta);
				z = -Math.cos(beta);         

				p.push(x * radius, -height/2, z * radius);
				n.push(x, 0, z);
				t.push(1.0 - j / sides, 0);

				p.push(x * radius, height/2, z * radius);
				n.push(x, 0, z);
				t.push(1.0 - j / sides, 1);
				
				if (j > 0)
				{
					i.push(k + 0);
					i.push(k + 1);
					i.push(k + 2);
					
					i.push(k + 2);
					i.push(k + 1);
					i.push(k + 3);
					
					k += 2;
				}
			}
			
			if (radius > 0)
			{
				var base = p.length / 3;
				
				for (j=sides-1; j>=0; j--)
				{
					beta = j * delta;
					x = radius * Math.sin(beta);
					z = -radius * Math.cos(beta);  

					p.push(x, height/2, z);
					n.push(0, 1, 0);
					t.push(x / radius / 2 + 0.5, -z / radius / 2 + 0.5);
				}
				
				var h = base + 1;
				
				for (j=2; j<sides; j++) 
				{
					i.push(base);
					i.push(h);
					
					h = base + j;
					i.push(h);
				}
				
				base = p.length / 3;
				
				for (j=sides-1; j>=0; j--)
				{
					beta = j * delta;
					x = radius * Math.sin(beta);
					z = -radius * Math.cos(beta); 

					p.push(x, -height/2, z);
					n.push(0, -1, 0);
					t.push(x / radius / 2 + 0.5, z / radius / 2 + 0.5);
				}
				
				h = base + 1;
				
				for (j=2; j<sides; j++) 
				{
					i.push(h);
					i.push(base);
					
					h = base + j;
					i.push(h);
				}
			}
			
			this._mesh._positions = p;
			this._mesh._normals = n;
			this._mesh._texCoords = t;
            this._mesh._indices = i;
			this._mesh._invalidate = true;
        }
    )
);

/* ### PointSet ### */
x3dom.registerNodeType(
    "PointSet",
    "Geometry3D",
    defineClass(x3dom.nodeTypes.X3DGeometryNode,
        function (ctx) {
            x3dom.nodeTypes.PointSet.superClass.call(this, ctx);
            
            this.addField_SFNode('coord', x3dom.nodeTypes.Coordinate);
            this.addField_SFNode('color', x3dom.nodeTypes.Color);
        },
        {
            nodeChanged: function()
            {
                var time0 = new Date().getTime();
                
                var coordNode = this._cf.coord.node;
                x3dom.debug.assert(coordNode);
                var positions = coordNode._vf.point;
                
                var colorNode = this._cf.color.node;
                var colors = [];
                if (colorNode) {
                    colors = colorNode._vf.color;
                    x3dom.debug.assert(positions.length == colors.length);
                }
                else {
                    for (var i=0, n=positions.length; i<n; i++)
                        colors.push(1.0);
                }
                
                this._mesh._indices = [];
                this._mesh._positions = positions.toGL();
                this._mesh._colors = colors.toGL();
                this._mesh._normals = [];
                this._mesh._texCoords = [];
                this._mesh._lit = false;
                this._mesh._invalidate = true;
                
                var time1 = new Date().getTime() - time0;
                //x3dom.debug.logInfo("Mesh load time: " + time1 + " ms");
            },
            
            fieldChanged: function(fieldName)
            {
                if (fieldName == "coord")   // same as in IFS
                {
                    var pnts = this._cf.coord.node._vf.point;
                    var i, n = pnts.length;
                    
                    this._mesh._positions = [];
                    
                    // TODO; optimize (is there a memcopy?)
                    for (i=0; i<n; i++)
                    {
						this._mesh._positions.push(pnts[i].x);
						this._mesh._positions.push(pnts[i].y);
						this._mesh._positions.push(pnts[i].z);
                    }
                    
                    this._mesh._invalidate = true;
                    
                    // FIXME; we need fieldMask instead of one flag!
                    Array.forEach(this._parentNodes, function (node) {
                        node._dirty = true;
                    });
                }
            }
        }
    )
);


/* ### Text ### */
x3dom.registerNodeType(
    "Text",
    "Geometry3D",
    defineClass(x3dom.nodeTypes.X3DGeometryNode,
        function (ctx) {
            x3dom.nodeTypes.Text.superClass.call(this, ctx);
    
            this.addField_MFString(ctx, 'string', []);
			this.addField_MFFloat(ctx, 'length', []);
	        this.addField_SFFloat(ctx, 'maxExtent', 0.0);
    		
            this.addField_SFNode ('fontStyle', x3dom.nodeTypes.X3DFontStyleNode);	
        },
		{
			nodeChanged: function() {	
				if (!this._cf.fontStyle.node) {
					this.addChild(x3dom.nodeTypes.FontStyle.defaultNode());
				}
			}			
	    }
    )
);


/* ### X3DComposedGeometryNode ### */
x3dom.registerNodeType(
    "X3DComposedGeometryNode",
    "Base",
    defineClass(x3dom.nodeTypes.X3DGeometryNode,
        function (ctx) {
            x3dom.nodeTypes.X3DComposedGeometryNode.superClass.call(this, ctx);
        }
    )
);


/* ### IndexedFaceSet ### */
x3dom.registerNodeType(
    "IndexedFaceSet",
    "Geometry3D",
    defineClass(x3dom.nodeTypes.X3DComposedGeometryNode,
        function (ctx) {
            x3dom.nodeTypes.IndexedFaceSet.superClass.call(this, ctx);
            
			this.addField_SFFloat(ctx, 'creaseAngle', 0);	// TODO
            this.addField_SFBool(ctx, 'colorPerVertex', true);
            this.addField_SFBool(ctx, 'normalPerVertex', true);
            
            this.addField_MFInt32(ctx, 'coordIndex', []);
            this.addField_MFInt32(ctx, 'normalIndex', []);
            this.addField_MFInt32(ctx, 'colorIndex', []);
            this.addField_MFInt32(ctx, 'texCoordIndex', []);
            
            this.addField_SFNode('coord', x3dom.nodeTypes.Coordinate);
            this.addField_SFNode('normal', x3dom.nodeTypes.Normal);
            this.addField_SFNode('color', x3dom.nodeTypes.Color);
            this.addField_SFNode('texCoord', x3dom.nodeTypes.TextureCoordinate);
        },
        {
            nodeChanged: function()
            {
                var time0 = new Date().getTime();
                
                var indexes = this._vf.coordIndex;
                var normalInd = this._vf.normalIndex;
                var texCoordInd = this._vf.texCoordIndex;
                var colorInd = this._vf.colorIndex;
                
                var hasNormal = false, hasNormalInd = false;
                var hasTexCoord = false, hasTexCoordInd = false;
                var hasColor = false, hasColorInd = false;
                
                // TODO; implement colorPerVertex/normalPerVertex also for single index
                var colPerVert = this._vf.colorPerVertex;
                var normPerVert = this._vf.normalPerVertex;
                
                if (normalInd.length > 0)
                {
                    hasNormalInd = true;
                }
                if (texCoordInd.length > 0)
                {
                    hasTexCoordInd = true;
                }
                if (colorInd.length > 0)
                {
                    hasColorInd = true;
                }
                
                var positions, normals, texCoords, colors;
                
                var coordNode = this._cf.coord.node;
                x3dom.debug.assert(coordNode);
                positions = coordNode._vf.point;
                
                var normalNode = this._cf.normal.node;
                if (normalNode) 
                {
                    hasNormal = true;
                    normals = normalNode._vf.vector;
                }
                else {
                    hasNormal = false;
                }

                var texCoordNode = this._cf.texCoord.node;
                if (texCoordNode) 
                {
                    hasTexCoord = true;
                    texCoords = texCoordNode._vf.point;
                }
                else {
                    hasTexCoord = false;
                }

                var colorNode = this._cf.color.node;
                if (colorNode) 
                {
                    hasColor = true;
                    colors = colorNode._vf.color;
                }
                else {
                    hasColor = false;
                }

                this._mesh._indices = [];
                this._mesh._positions = [];
                this._mesh._normals = [];
                this._mesh._texCoords = [];
                this._mesh._colors = [];
                
                var i, t, cnt, faceCnt;
                var p0, p1, p2, n0, n1, n2, t0, t1, t2, c0, c1, c2;
                
                if ( (hasNormal && hasNormalInd) || 
                     (hasTexCoord && hasTexCoordInd) || 
                     (hasColor && hasColorInd) )
                {
                    // Found MultiIndex Mesh
                    t = 0;
                    cnt = 0;
                    faceCnt = 0;
                    this._mesh._multiIndIndices = [];
                    
                    for (i=0; i < indexes.length; ++i) 
                    {
                        // Convert non-triangular polygons to a triangle fan
                        // (TODO: this assumes polygons are convex)
                        if (indexes[i] == -1) {
                            t = 0;
                            continue;
                        }
                        if (hasNormalInd) {
                            x3dom.debug.assert(normalInd[i] != -1);
                        }
                        if (hasTexCoordInd) {
                            x3dom.debug.assert(texCoordInd[i] != -1);
                        }
                        if (hasColorInd) {
                            x3dom.debug.assert(colorInd[i] != -1);
                        }

                        //TODO: OPTIMIZE but think about cache coherence regarding arrays!!!
                        switch (t) 
                        {
                            case 0: 
                                p0 = +indexes[i];
                                if (hasNormalInd && normPerVert) { n0 = +normalInd[i]; }
                                else { n0 = p0; }
                                if (hasTexCoordInd) { t0 = +texCoordInd[i]; }
                                else { t0 = p0; }
                                if (hasColorInd && colPerVert) { c0 = +colorInd[i]; }
                                else { c0 = p0; }
                                t = 1; 
                            break;
                            case 1: 
                                p1 = +indexes[i];
                                if (hasNormalInd && normPerVert) { n1 = +normalInd[i]; }
                                else { n1 = p1; }
                                if (hasTexCoordInd) { t1 = +texCoordInd[i]; }
                                else { t1 = p1; }
                                if (hasColorInd && colPerVert) { c1 = +colorInd[i]; }
                                else { c1 = p1; }
                                t = 2; 
                            break;
                            case 2: 
                                p2 = +indexes[i];
                                if (hasNormalInd && normPerVert) { n2 = +normalInd[i]; }
                                else if (hasNormalInd && !normPerVert) { n2 = +normalInd[faceCnt]; }
                                else { n2 = p2; }
                                if (hasTexCoordInd) { t2 = +texCoordInd[i]; }
                                else { t2 = p2; }
                                if (hasColorInd && colPerVert) { c2 = +colorInd[i]; }
                                else if (hasColorInd && !colPerVert) { c2 = +colorInd[faceCnt]; }
                                else { c2 = p2; }
                                t = 3; 
                                
                                this._mesh._indices.push(cnt++, cnt++, cnt++);
                                
                                this._mesh._positions.push(positions[p0].x);
                                this._mesh._positions.push(positions[p0].y);
                                this._mesh._positions.push(positions[p0].z);
                                this._mesh._positions.push(positions[p1].x);
                                this._mesh._positions.push(positions[p1].y);
                                this._mesh._positions.push(positions[p1].z);
                                this._mesh._positions.push(positions[p2].x);
                                this._mesh._positions.push(positions[p2].y);
                                this._mesh._positions.push(positions[p2].z);
                                
                                if (hasNormal) {
                                    if (!normPerVert) {
                                        n0 = n2;
                                        n1 = n2;
                                    }
                                    this._mesh._normals.push(normals[n0].x);
                                    this._mesh._normals.push(normals[n0].y);
                                    this._mesh._normals.push(normals[n0].z);
                                    this._mesh._normals.push(normals[n1].x);
                                    this._mesh._normals.push(normals[n1].y);
                                    this._mesh._normals.push(normals[n1].z);
                                    this._mesh._normals.push(normals[n2].x);
                                    this._mesh._normals.push(normals[n2].y);
                                    this._mesh._normals.push(normals[n2].z);
                                }
                                else {
                                    this._mesh._multiIndIndices.push(p0, p1, p2);
                                }
                                
                                if (hasColor) {
                                    //assume RGB for now...
                                    if (!colPerVert) {
                                        c0 = c2;
                                        c1 = c2;
                                    }
                                    this._mesh._colors.push(colors[c0].r);
                                    this._mesh._colors.push(colors[c0].g);
                                    this._mesh._colors.push(colors[c0].b);
                                    this._mesh._colors.push(colors[c1].r);
                                    this._mesh._colors.push(colors[c1].g);
                                    this._mesh._colors.push(colors[c1].b);
                                    this._mesh._colors.push(colors[c2].r);
                                    this._mesh._colors.push(colors[c2].g);
                                    this._mesh._colors.push(colors[c2].b);
                                }
                                
                                if (hasTexCoord) {
                                    //assume 2d texCoords for now...
                                    this._mesh._texCoords.push(texCoords[t0].x);
                                    this._mesh._texCoords.push(texCoords[t0].y);
                                    this._mesh._texCoords.push(texCoords[t1].x);
                                    this._mesh._texCoords.push(texCoords[t1].y);
                                    this._mesh._texCoords.push(texCoords[t2].x);
                                    this._mesh._texCoords.push(texCoords[t2].y);
                                }
                                
                                faceCnt++;
                            break;
                            case 3: 
                                p1 = p2; 
                                n1 = n2;
                                t1 = t2;
                                p2 = +indexes[i];
                                if (hasNormalInd) { n2 = +normalInd[i]; }
                                else if (hasNormalInd && !normPerVert) { n2 = +normalInd[faceCnt]; }
                                else { n2 = p2; }
                                if (hasTexCoordInd) { t2 = +texCoordInd[i]; }
                                else { t2 = p2; }
                                if (hasColorInd && colPerVert) { c2 = +colorInd[i]; }
                                else if (hasColorInd && !colPerVert) { c2 = +colorInd[faceCnt]; }
                                else { c2 = p2; }
                                
                                this._mesh._indices.push(cnt++, cnt++, cnt++);
                                
                                this._mesh._positions.push(positions[p0].x);
                                this._mesh._positions.push(positions[p0].y);
                                this._mesh._positions.push(positions[p0].z);
                                this._mesh._positions.push(positions[p1].x);
                                this._mesh._positions.push(positions[p1].y);
                                this._mesh._positions.push(positions[p1].z);
                                this._mesh._positions.push(positions[p2].x);
                                this._mesh._positions.push(positions[p2].y);
                                this._mesh._positions.push(positions[p2].z);
                                
                                if (hasNormal) {
                                    if (!normPerVert) {
                                        n0 = n2;
                                        n1 = n2;
                                    }
                                    this._mesh._normals.push(normals[n0].x);
                                    this._mesh._normals.push(normals[n0].y);
                                    this._mesh._normals.push(normals[n0].z);
                                    this._mesh._normals.push(normals[n1].x);
                                    this._mesh._normals.push(normals[n1].y);
                                    this._mesh._normals.push(normals[n1].z);
                                    this._mesh._normals.push(normals[n2].x);
                                    this._mesh._normals.push(normals[n2].y);
                                    this._mesh._normals.push(normals[n2].z);
                                }
                                else {
                                    this._mesh._multiIndIndices.push(p0, p1, p2);
                                }
                                
                                if (hasColor) {
                                    //assume RGB for now...
                                    if (!colPerVert) {
                                        c0 = c2;
                                        c1 = c2;
                                    }
                                    this._mesh._colors.push(colors[c0].r);
                                    this._mesh._colors.push(colors[c0].g);
                                    this._mesh._colors.push(colors[c0].b);
                                    this._mesh._colors.push(colors[c1].r);
                                    this._mesh._colors.push(colors[c1].g);
                                    this._mesh._colors.push(colors[c1].b);
                                    this._mesh._colors.push(colors[c2].r);
                                    this._mesh._colors.push(colors[c2].g);
                                    this._mesh._colors.push(colors[c2].b);
                                }
                                
                                if (hasTexCoord) {
                                    //assume 2d texCoords for now...
                                    this._mesh._texCoords.push(texCoords[t0].x);
                                    this._mesh._texCoords.push(texCoords[t0].y);
                                    this._mesh._texCoords.push(texCoords[t1].x);
                                    this._mesh._texCoords.push(texCoords[t1].y);
                                    this._mesh._texCoords.push(texCoords[t2].x);
                                    this._mesh._texCoords.push(texCoords[t2].y);
                                }
                                
                                faceCnt++;
                            break;
                            default:
                        }
                    }
                    
                    if (!hasNormal) {
                        this._mesh.calcNormals(this._vf.creaseAngle);
                    }
                    if (!hasTexCoord) {
                        this._mesh.calcTexCoords();
                    }

                    //TODO: this currently does nothing...
                    this._mesh.remapData();
                
                } // if isMulti
                else
                {
                    t = 0;
                    
                    for (i = 0; i < indexes.length; ++i) 
                    {
                        // Convert non-triangular polygons to a triangle fan
                        // (TODO: this assumes polygons are convex)
                        if (indexes[i] == -1) {
                            t = 0;
                            continue;
                        }
                        switch (t) {
                        case 0: n0 = +indexes[i]; t = 1; break;
                        case 1: n1 = +indexes[i]; t = 2; break;
                        case 2: n2 = +indexes[i]; t = 3; this._mesh._indices.push(n0, n1, n2); break;
                        case 3: n1 = n2; n2 = +indexes[i]; this._mesh._indices.push(n0, n1, n2); break;
                        }
                    }
                    
                    this._mesh._positions = positions.toGL();
                    
                    if (hasNormal) {
                        this._mesh._normals = normals.toGL();
                    }
                    else {
                        this._mesh.calcNormals(this._vf.creaseAngle);
                    }
                    if (hasTexCoord) {
                        this._mesh._texCoords = texCoords.toGL();
                    }
                    else {
                        this._mesh.calcTexCoords();
                    }
                    if (hasColor) {
                        this._mesh._colors = colors.toGL();
                    }
                    this._mesh.remapData();
                }
                
                this._mesh._invalidate = true;
                
                var time1 = new Date().getTime() - time0;
                //x3dom.debug.logInfo("Mesh load time: " + time1 + " ms");
            },
            
            fieldChanged: function(fieldName)
            {
                if (fieldName == "coord")
                {
                    // TODO; multi-index with different this._mesh._indices
                    var pnts = this._cf.coord.node._vf.point;
                    var i, n = pnts.length;
                    
                    this._mesh._positions = [];
                    
                    // TODO; optimize (is there a memcopy?)
                    for (i=0; i<n; i++)
                    {
						this._mesh._positions.push(pnts[i].x);
						this._mesh._positions.push(pnts[i].y);
						this._mesh._positions.push(pnts[i].z);
                    }
                    
                    this._mesh._invalidate = true;
                    
                    // FIXME; we need fieldMask instead of one flag!
                    Array.forEach(this._parentNodes, function (node) {
                        node._dirty = true;
                    });
                }
            }
        }
    )
);


/* ### X3DGeometricPropertyNode ### */
x3dom.registerNodeType(
    "X3DGeometricPropertyNode",
    "Base",
    defineClass(x3dom.nodeTypes.X3DNode,
        function (ctx) {
            x3dom.nodeTypes.X3DGeometricPropertyNode.superClass.call(this, ctx);
        }
    )
);

/* ### Coordinate ### */
x3dom.registerNodeType(
    "Coordinate",
    "Base",
    defineClass(x3dom.nodeTypes.X3DGeometricPropertyNode,
        function (ctx) {
            x3dom.nodeTypes.Coordinate.superClass.call(this, ctx);
            
            //this._vf.point = [];
            this.addField_MFVec3f(ctx, 'point', []);
        },
        {
            fieldChanged: function (fieldName) {
	            Array.forEach(this._parentNodes, function (node) {
		            node.fieldChanged("coord");
            	});
			}
        }
    )
);

/* ### TextureCoordinate ### */
x3dom.registerNodeType(
    "TextureCoordinate",
    "Base",
    defineClass(x3dom.nodeTypes.X3DGeometricPropertyNode,
        function (ctx) {
            x3dom.nodeTypes.TextureCoordinate.superClass.call(this, ctx);
            
            this.addField_MFVec2f(ctx, 'point', []);
        }
    )
);

/* ### Normal ### */
x3dom.registerNodeType(
    "Normal",
    "Base",
    defineClass(x3dom.nodeTypes.X3DGeometricPropertyNode,
        function (ctx) {
            x3dom.nodeTypes.Normal.superClass.call(this, ctx);
            
            this.addField_MFVec3f(ctx, 'vector', []);
        }
    )
);

/* ### Color ### */
x3dom.registerNodeType(
    "Color",
    "Base",
    defineClass(x3dom.nodeTypes.X3DGeometricPropertyNode,
        function (ctx) {
            x3dom.nodeTypes.Color.superClass.call(this, ctx);
            
            this.addField_MFColor(ctx, 'color', []);
        }
    )
);


/* ### X3DFontStyleNode ### */
x3dom.registerNodeType( 
    "X3DFontStyleNode",
    "Base",
    defineClass(x3dom.nodeTypes.X3DNode,
        function (ctx) {
            x3dom.nodeTypes.X3DFontStyleNode.superClass.call(this, ctx);
        }
    )
);

/* ### FontStyle ### */
x3dom.registerNodeType( 
    "FontStyle",
    "Text",
    defineClass(x3dom.nodeTypes.X3DFontStyleNode,
        function (ctx) {
            x3dom.nodeTypes.FontStyle.superClass.call(this, ctx);
    
            this.addField_MFString(ctx, 'family', ['SERIF']);
            this.addField_SFBool(ctx, 'horizontal', true);
            this.addField_MFString(ctx, 'justify', ['BEGIN']);
			this.addField_SFString(ctx, 'language', "");
            this.addField_SFBool(ctx, 'leftToRight', true);
            this.addField_SFFloat(ctx, 'size', 1.0);
            this.addField_SFFloat(ctx, 'spacing', 1.0);
			this.addField_SFString(ctx, 'style', "PLAIN");
            this.addField_SFBool(ctx, 'topToBottom', true);
        }
    )
);

x3dom.nodeTypes.FontStyle.defaultNode = function() {
	if (!x3dom.nodeTypes.FontStyle._defaultNode) {
		x3dom.nodeTypes.FontStyle._defaultNode = new x3dom.nodeTypes.FontStyle();
        x3dom.nodeTypes.FontStyle._defaultNode.nodeChanged();
	}
	return x3dom.nodeTypes.FontStyle._defaultNode;
};

/* ### X3DChildNode ### */
x3dom.registerNodeType(
    "X3DChildNode",
    "Base",
    defineClass(x3dom.nodeTypes.X3DNode,
        function (ctx) {
            x3dom.nodeTypes.X3DChildNode.superClass.call(this, ctx);
        }
    )
);

/* ### X3DSoundNode ### */
x3dom.registerNodeType(
    "X3DSoundNode",
    "Sound",
    defineClass(x3dom.nodeTypes.X3DChildNode,
        function (ctx) {
            x3dom.nodeTypes.X3DSoundNode.superClass.call(this, ctx);
        }
    )
);

/* ### Sound ### */
x3dom.registerNodeType(
    "Sound",
    "Sound",
    defineClass(x3dom.nodeTypes.X3DSoundNode,
        function (ctx) {
            x3dom.nodeTypes.Sound.superClass.call(this, ctx);
            
            this.addField_SFNode('source', x3dom.nodeTypes.X3DSoundSourceNode);
        }
    )
);

/* ### X3DTimeDependentNode ### */
x3dom.registerNodeType( 
    "X3DTimeDependentNode",
    "Time",
    defineClass(x3dom.nodeTypes.X3DChildNode,
        function (ctx) {
            x3dom.nodeTypes.X3DTimeDependentNode.superClass.call(this, ctx);
            
            this.addField_SFBool(ctx, 'loop', false);
        }
    )
);

/* ### X3DSoundSourceNode ### */
x3dom.registerNodeType( 
    "X3DSoundSourceNode",
    "Sound",
    defineClass(x3dom.nodeTypes.X3DTimeDependentNode,
        function (ctx) {
            x3dom.nodeTypes.X3DSoundSourceNode.superClass.call(this, ctx);
        }
    )
);

/* ### AudioClip ### */
x3dom.registerNodeType( 
    "AudioClip",
    "Sound",
    defineClass(x3dom.nodeTypes.X3DSoundSourceNode,
        function (ctx) {
            x3dom.nodeTypes.AudioClip.superClass.call(this, ctx);
            
            this.addField_MFString(ctx, 'url', []);
            
            this._audio = null;
        },
        {
            nodeChanged: function() 
            {
                x3dom.debug.logInfo('Loading sound file: ' + this._vf.url);
                this._audio = document.createElement('audio');
                this._audio.setAttribute('autobuffer', 'true');
                this._audio.setAttribute('autoplay', 'true');
                this._audio.setAttribute('src', this._vf.url);
                var p = document.getElementsByTagName('body')[0];
                p.appendChild(this._audio);
                
                var that = this;
                
                var audioDone = function()
                {
                    if (that._vf.loop === true)
                    {
                        that._audio.play();
                    }
                };
                
                this._audio.addEventListener("ended", audioDone, true);
            }
        }
    )
);

/* ### X3DBindableNode ### */
x3dom.registerNodeType(
    "X3DBindableNode",
    "Base",
    defineClass(x3dom.nodeTypes.X3DChildNode,
        function (ctx) {
          x3dom.nodeTypes.X3DBindableNode.superClass.call(this, ctx);

			this._stack = null;
        },
		{
			initDefault: function() {
				;
			},
			activate: function () {
				;
			},
			deactivate: function () {
				;
			},
			nodeChanged: function() {
			}
			
		}
    )
);

/* ### X3DBindableNode ### */
/*
x3dom.registerNodeType(
    "X3DViewpointBindable",
    "Base",
    defineClass(x3dom.nodeTypes.X3DBindableNode,
        function (ctx) {
            x3dom.nodeTypes.X3DViewpointBindable.superClass.call(this, ctx);
        },
		{
			linkStack: function() {
				if (!this._stack) {
					var bag = findParentProperty("_bindableBag");
					this._stack = bag ? stack.X3DViewpointBindable : null;
					
					if (!this._stack) {
						this._stack.bindBag.push(this);
					}
				}
			}
			
		}
    )
);
*/

/* ### Viewpoint ### */
x3dom.registerNodeType( 
    "Viewpoint",
    "Navigation",
    defineClass(x3dom.nodeTypes.X3DBindableNode,
        function (ctx) {
            x3dom.nodeTypes.Viewpoint.superClass.call(this, ctx);
			this.addField_SFFloat(ctx, 'fieldOfView', 0.785398);
            this.addField_SFVec3f(ctx, 'position', 0, 0, 10);
            this.addField_SFRotation(ctx, 'orientation', 0, 0, 0, 1);
			this.addField_SFVec3f(ctx, 'centerOfRotation', 0, 0, 0);
            this.addField_SFFloat(ctx, 'zNear', 0.1);
            this.addField_SFFloat(ctx, 'zFar', 100000);
            
            this._viewMatrix = this._vf.orientation.toMatrix().transpose().
				mult(x3dom.fields.SFMatrix4f.translation(this._vf.position.negate()));
            this._projMatrix = null;
        },
        {
            fieldChanged: function (fieldName) {
                if (fieldName == "position" || fieldName == "orientation") {
                    this._viewMatrix = this._vf.orientation.toMatrix().transpose().
                        mult(x3dom.fields.SFMatrix4f.translation(this._vf.position.negate()));
                }
                else if (fieldName == "fieldOfView" || 
                         fieldName == "zNear" || fieldName == "zFar") {
                    this._projMatrix = null;   // only trigger refresh
                }
            },
            
			getCenterOfRotation: function() {
                return this._vf.centerOfRotation;
			},
			getViewMatrix: function() {
                return this._viewMatrix;
			},
			getFieldOfView: function() {
				return this._vf.fieldOfView;
			},
            
            setView: function(newView) {
                this._viewMatrix = newView;
            },
            resetView: function() {
                this._viewMatrix = this._vf.orientation.toMatrix().transpose().
                    mult(x3dom.fields.SFMatrix4f.translation(this._vf.position.negate()));
            },
            
            getProjectionMatrix: function(aspect)
            {
                if (this._projMatrix == null)
                {
                    var fovy = this._vf.fieldOfView;
                    var zfar = this._vf.zFar;
                    var znear = this._vf.zNear;
                    
                    var f = 1/Math.tan(fovy/2);
                    this._projMatrix = new x3dom.fields.SFMatrix4f(
                        f/aspect, 0, 0, 0,
                        0, f, 0, 0,
                        0, 0, (znear+zfar)/(znear-zfar), 2*znear*zfar/(znear-zfar),
                        0, 0, -1, 0
                    );
                }
                return this._projMatrix;
            }
        }
    )
);

/* ### Fog ### */
x3dom.registerNodeType( 
    "Fog",
    "EnvironmentalEffects",
    defineClass(x3dom.nodeTypes.X3DBindableNode,
        function (ctx) {
            x3dom.nodeTypes.Fog.superClass.call(this, ctx);
            
			this.addField_SFColor(ctx, 'color', 1, 1, 1);
            this.addField_SFString(ctx, 'fogType', "LINEAR");
			this.addField_SFFloat(ctx, 'visibilityRange', 0);
            
            x3dom.debug.logInfo("Fog NYI");
        },
        {
			// methods
        }
    )
);

/* ### NavigationInfo ### */
x3dom.registerNodeType( 
    "NavigationInfo",
    "Navigation",
    defineClass(x3dom.nodeTypes.X3DBindableNode,
        function (ctx) {
            x3dom.nodeTypes.NavigationInfo.superClass.call(this, ctx);
            
			this.addField_SFBool(ctx, 'headlight', true);
            this.addField_MFString(ctx, 'type', ["EXAMINE"]);
            
            x3dom.debug.logInfo("NavType: " + this._vf.type[0].toLowerCase());
        },
        {
			// methods
        }
    )
);

/* ### WorldInfo ### */
x3dom.registerNodeType( 
    "WorldInfo",
    "Base",
    defineClass(x3dom.nodeTypes.X3DChildNode,
        function (ctx) {
            x3dom.nodeTypes.WorldInfo.superClass.call(this, ctx);
            
            this.addField_MFString(ctx, 'info', []);
			this.addField_SFString(ctx, 'title', "");
            
            x3dom.debug.logInfo(this._vf.info);
            x3dom.debug.logInfo(this._vf.title);
        },
        {
			// methods
        }
    )
);

/* ### Background ### */
x3dom.registerNodeType(
    "Background",
    "EnvironmentalEffects",
    defineClass(x3dom.nodeTypes.X3DBindableNode,
        function (ctx) {
            x3dom.nodeTypes.Background.superClass.call(this, ctx);
			
            this.addField_MFColor(ctx, 'skyColor', [new x3dom.fields.SFColor(0,0,0)]);
            this.addField_MFFloat(ctx, 'skyAngle', []);
            this.addField_MFColor(ctx, 'groundColor', []);
            this.addField_MFFloat(ctx, 'groundAngle', []);
            this.addField_SFFloat(ctx, 'transparency', 0);
            this.addField_MFString(ctx, 'backUrl', []);
            this.addField_MFString(ctx, 'bottomUrl', []);
            this.addField_MFString(ctx, 'frontUrl', []);
            this.addField_MFString(ctx, 'leftUrl', []);
            this.addField_MFString(ctx, 'rightUrl', []);
            this.addField_MFString(ctx, 'topUrl', []);
        },
        {
			getSkyColor: function() {
				return this._vf.skyColor;
			},
			getTransparency: function() {
				return this._vf.transparency;
			},
            getTexUrl: function() {
                return [
                    this._vf.backUrl,
                    this._vf.frontUrl,
                    this._vf.bottomUrl,
                    this._vf.topUrl,
                    this._vf.leftUrl,
                    this._vf.rightUrl
                ];
            }
        }
    )
);

/* ### X3DLightNode ### */
x3dom.registerNodeType( 
    "X3DLightNode",
    "Lighting",
    defineClass(x3dom.nodeTypes.X3DChildNode,
        function (ctx) {
            x3dom.nodeTypes.X3DLightNode.superClass.call(this, ctx);
            
			this.addField_SFFloat(ctx, 'ambientIntensity', 0);
            this.addField_SFColor(ctx, 'color', 1, 1, 1);
			this.addField_SFFloat(ctx, 'intensity', 1);
            this.addField_SFBool(ctx, 'global', false);
            this.addField_SFBool(ctx, 'on', true);
            this.addField_SFFloat(ctx, 'shadowIntensity', 0);
        },
        {
			getViewMatrix: function(vec) {
                return x3dom.fields.SFMatrix4f.identity;
            }
        }
    )
);

/* ### DirectionalLight ### */
x3dom.registerNodeType( 
    "DirectionalLight",
    "Lighting",
    defineClass(x3dom.nodeTypes.X3DLightNode,
        function (ctx) {
            x3dom.nodeTypes.DirectionalLight.superClass.call(this, ctx);
            
            this.addField_SFVec3f(ctx, 'direction', 0, 0, -1);
        },
        {
            getViewMatrix: function(vec) {
                var dir = this._vf.direction.normalize();
                var orientation = x3dom.fields.Quaternion.rotateFromTo(
                        new x3dom.fields.SFVec3f(0, 0, -1), dir);
                return orientation.toMatrix().transpose().
                        mult(x3dom.fields.SFMatrix4f.translation(vec.negate()));
            }
        }
    )
);

/* ### PointLight ### */
x3dom.registerNodeType( 
    "PointLight",
    "Lighting",
    defineClass(x3dom.nodeTypes.X3DLightNode,
        function (ctx) {
            x3dom.nodeTypes.PointLight.superClass.call(this, ctx);
            
            this.addField_SFVec3f(ctx, 'attenuation', 1, 0, 0);
            this.addField_SFVec3f(ctx, 'location', 0, 0, 0);
            this.addField_SFFloat(ctx, 'radius', 100);
            
            this._vf.global = true;
            x3dom.debug.logInfo("PointLight NYI");  // TODO: gfx handling
        },
        {
            getViewMatrix: function(vec) {
                var pos = this._vf.location;
                var orientation = x3dom.fields.Quaternion.rotateFromTo(
                        new x3dom.fields.SFVec3f(0, 0, -1), vec);
                return orientation.toMatrix().transpose().
                        mult(x3dom.fields.SFMatrix4f.translation(pos.negate()));
            }
        }
    )
);

/* ### SpotLight ### */
x3dom.registerNodeType( 
    "SpotLight",
    "Lighting",
    defineClass(x3dom.nodeTypes.X3DLightNode,
        function (ctx) {
            x3dom.nodeTypes.SpotLight.superClass.call(this, ctx);
            
            this.addField_SFVec3f(ctx, 'direction', 0, 0, -1);
            this.addField_SFVec3f(ctx, 'attenuation', 1, 0, 0);
            this.addField_SFVec3f(ctx, 'location', 0, 0, 0);
            this.addField_SFFloat(ctx, 'radius', 100);
            this.addField_SFFloat(ctx, 'beamWidth', 1.5707963);
            this.addField_SFFloat(ctx, 'cutOffAngle', 1.5707963);
            
            this._vf.global = true;
            x3dom.debug.logInfo("SpotLight NYI");  // TODO: gfx handling
        },
        {
            getViewMatrix: function(vec) {
                var pos = this._vf.location;
                var dir = this._vf.direction.normalize();
                var orientation = x3dom.fields.Quaternion.rotateFromTo(
                        new x3dom.fields.SFVec3f(0, 0, -1), dir);
                return orientation.toMatrix().transpose().
                        mult(x3dom.fields.SFMatrix4f.translation(pos.negate()));
            }
        }
    )
);

/* ### X3DShapeNode ### */
x3dom.registerNodeType(
    "X3DShapeNode",
    "Base",
    defineClass(x3dom.nodeTypes.X3DChildNode,
        function (ctx) {
            x3dom.nodeTypes.X3DShapeNode.superClass.call(this, ctx);
        }
    )
);

/* ### Shape ### */
x3dom.registerNodeType(
    "Shape",
    "Shape",
    defineClass(x3dom.nodeTypes.X3DShapeNode,
        function (ctx) {
            x3dom.nodeTypes.Shape.superClass.call(this, ctx);
            
            this.addField_SFNode('appearance', x3dom.nodeTypes.X3DAppearanceNode);
            this.addField_SFNode('geometry', x3dom.nodeTypes.X3DGeometryNode);
            
            // TODO; use more specific _dirty object for positions, normals etc.
            this._dirty = true;
        },
        {
			nodeChanged: function () {
				if (!this._cf.appearance.node) {
					this.addChild(x3dom.nodeTypes.Appearance.defaultNode());
				}
			},
            
            collectDrawableObjects: function (transform, out) {
                // TODO: culling etc
                if (out !== null) 
                {
                    out.push( [transform, this] );
                }
            },
			
			getVolume: function(min, max, invalidate) {
				return this._cf.geometry.node.getVolume(min, max, invalidate);
			},
			
			getCenter: function() {
				return this._cf.geometry.node.getCenter();
			},
            
            doIntersect: function(line) {
                return this._cf.geometry.node.doIntersect(line);
            },
			
			isSolid: function() {
				return this._cf.geometry.node._vf.solid;
			},
            
            isCCW: function() {
                return this._cf.geometry.node._vf.ccw;
            }
        }
    )
);

// ### X3DGroupingNode ###
x3dom.registerNodeType(
    "X3DGroupingNode",
    "Base",
    defineClass(x3dom.nodeTypes.X3DChildNode,
        function (ctx) {
            x3dom.nodeTypes.X3DGroupingNode.superClass.call(this, ctx);
            
            this.addField_SFBool(ctx, 'render', true);
			this.addField_MFNode ('children', x3dom.nodeTypes.X3DChildNode);
            // FIXME; add addChild and removeChild slots ?
        },
        {
            // Collects array of [transform matrix, node] for all objects that should be drawn.
            collectDrawableObjects: function (transform, out)
            {
                if (!this._vf.render) {
                    return;
                }
                
                for (var i=0; i<this._childNodes.length; i++) {
                    if (this._childNodes[i]) {
                        var childTransform = this._childNodes[i].transformMatrix(transform);
                        this._childNodes[i].collectDrawableObjects(childTransform, out);
                    }
                }
            }
        }
    )
);

// ### Switch ###
x3dom.registerNodeType(
    "Switch",
    "Grouping",
    defineClass(x3dom.nodeTypes.X3DGroupingNode,
        function (ctx) {
            x3dom.nodeTypes.Switch.superClass.call(this, ctx);
			
			this.addField_SFInt32(ctx, 'whichChoice', -1);
        },
        {
            getVolume: function (min, max, invalidate) 
            {
                if (this._vf.whichChoice < 0 || 
                    this._vf.whichChoice >= this._childNodes.length) {
                    return false;
                }
                
                var valid = false;
                
                if (this._childNodes[this._vf.whichChoice]) {
                    // FIXME; this code is still a bit strange and buggy...
                    var childMin = new x3dom.fields.SFVec3f(
                            Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
                    var childMax = new x3dom.fields.SFVec3f(
                            Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
                    
                    valid = this._childNodes[this._vf.whichChoice].getVolume(
                                    childMin, childMax, invalidate) || valid;
                    
                    if (valid) {
                        if (min.x > childMin.x) { min.x = childMin.x; }
                        if (min.y > childMin.y) { min.y = childMin.y; }
                        if (min.z > childMin.z) { min.z = childMin.z; }
                            
                        if (max.x < childMax.x) { max.x = childMax.x; }
                        if (max.y < childMax.y) { max.y = childMax.y; }
                        if (max.z < childMax.z) { max.z = childMax.z; }
                    }
                }
                
                return valid;
            },

            find: function (type) 
            {
                if (this._vf.whichChoice < 0 || 
                    this._vf.whichChoice >= this._childNodes.length) {
                    return null;
                }
                
                if (this._childNodes[this._vf.whichChoice]) {
                    if (this._childNodes[this._vf.whichChoice].constructor == type) {
                        return this._childNodes[this._vf.whichChoice];
                    }
                    
                    var c = this._childNodes[this._vf.whichChoice].find(type);
                    if (c) {
                        return c;
                    }
                }
                
                return null;
            },

            findAll: function (type)
            {
                if (this._vf.whichChoice < 0 || 
                    this._vf.whichChoice >= this._childNodes.length) {
                    return [];
                }
                
                var found = [];
                
                if (this._childNodes[this._vf.whichChoice]) {
                    if (this._childNodes[this._vf.whichChoice].constructor == type) {
                        found.push(this._childNodes[this._vf.whichChoice]);
                    }
                    
                    found = found.concat(this._childNodes[this._vf.whichChoice].findAll(type)); 
                }
                
                return found;
            },

            // Collects array of [transform matrix, node] for all objects that should be drawn.
            collectDrawableObjects: function (transform, out)
            {
                if (this._vf.whichChoice < 0 || 
                    this._vf.whichChoice >= this._childNodes.length) {
                    return;
                }
                
                if (this._childNodes[this._vf.whichChoice]) {
                    var childTransform = this._childNodes[this._vf.whichChoice].transformMatrix(transform);
                    this._childNodes[this._vf.whichChoice].collectDrawableObjects(childTransform, out);
                }
            },
            
            doIntersect: function(line)
            {
                if (this._vf.whichChoice < 0 || 
                    this._vf.whichChoice >= this._childNodes.length) {
                    return false;
                }
                
                if (this._childNodes[this._vf.whichChoice]) {
                    return this._childNodes[this._vf.whichChoice].doIntersect(line);
                }
                
                return false;
            }
        }
    )
);

// ### X3DTransformNode ###
x3dom.registerNodeType(
    "X3DTransformNode",
    "Grouping",
    defineClass(x3dom.nodeTypes.X3DGroupingNode,
        function (ctx) {
            x3dom.nodeTypes.X3DTransformNode.superClass.call(this, ctx);
           
			// holds the current matrix
            this._trafo = null;
        },
        {   
            transformMatrix: function(transform) {
                return transform.mult(this._trafo);
            },
			
			getVolume: function(min, max, invalidate) 
            {
				var nMin = new x3dom.fields.SFVec3f(
                        Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
				var nMax = new x3dom.fields.SFVec3f(
                        Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
                var valid = false;
                
				for (var i=0; i<this._childNodes.length; i++)
				{
					if (this._childNodes[i])
					{
						var childMin = new x3dom.fields.SFVec3f(
                                Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
						var childMax = new x3dom.fields.SFVec3f(
                                Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
						
						valid = this._childNodes[i].getVolume(
                                        childMin, childMax, invalidate) || valid;
						
                        if (valid)  // values only set by Mesh.BBox()
                        {
                            if (nMin.x > childMin.x) nMin.x = childMin.x;
                            if (nMin.y > childMin.y) nMin.y = childMin.y;
                            if (nMin.z > childMin.z) nMin.z = childMin.z;
                                
                            if (nMax.x < childMax.x) nMax.x = childMax.x;
                            if (nMax.y < childMax.y) nMax.y = childMax.y;
                            if (nMax.z < childMax.z) nMax.z = childMax.z;
                        }
					}
				}
				
                if (valid)
                {
                    nMin = this._trafo.multMatrixPnt(nMin);
                    nMax = this._trafo.multMatrixPnt(nMax);
                    
                    min.x = nMin.x;
                    min.y = nMin.y;
                    min.z = nMin.z;
                        
                    max.x = nMax.x;
                    max.y = nMax.y;
                    max.z = nMax.z;
                }
                return valid;
			},
            
            doIntersect: function(line) 
            {
                var isect = false;
                var mat = this._trafo.inverse();
                
                var tmpPos = new x3dom.fields.SFVec3f(line.pos.x, line.pos.y, line.pos.z);
                var tmpDir = new x3dom.fields.SFVec3f(line.dir.x, line.dir.y, line.dir.z);
                
                line.pos = mat.multMatrixPnt(line.pos);
                line.dir = mat.multMatrixVec(line.dir);
                
                for (var i=0; i<this._childNodes.length; i++) 
                {
                    if (this._childNodes[i]) 
                    {
                        //TODO: check for _nearest_ hit object and don't stop on first!
                        isect = this._childNodes[i].doIntersect(line);
                        
                        if (isect)
                        {
                            line.hitPoint = this._trafo.multMatrixPnt(line.hitPoint);
                            break;
                        }
                    }
                }
                
                line.pos = new x3dom.fields.SFVec3f(tmpPos.x, tmpPos.y, tmpPos.z);
                line.dir = new x3dom.fields.SFVec3f(tmpDir.x, tmpDir.y, tmpDir.z);
                
                return isect;
            }
        }
    )
);

// ### Transform ###
x3dom.registerNodeType(
    "Transform",
    "Grouping",
    defineClass(x3dom.nodeTypes.X3DTransformNode,
        function (ctx) {
            x3dom.nodeTypes.Transform.superClass.call(this, ctx);
            
			this.addField_SFVec3f(ctx, 'center', 0, 0, 0);
            this.addField_SFVec3f(ctx, 'translation', 0, 0, 0);
            this.addField_SFRotation(ctx, 'rotation', 0, 0, 0, 1);
            this.addField_SFVec3f(ctx, 'scale', 1, 1, 1);
			this.addField_SFRotation(ctx, 'scaleOrientation', 0, 0, 0, 1);
			// BUG! default of rotation according to spec is (0, 0, 1, 0)
			//		but results sometimes are wrong if not (0, 0, 0, 1)
			// TODO; check quaternion/ matrix code (probably in toMatrix()?)
            
            // P' = T * C * R * SR * S * -SR * -C * P
            this._trafo = x3dom.fields.SFMatrix4f.translation(this._vf.translation).
                mult(x3dom.fields.SFMatrix4f.translation(this._vf.center)).
                mult(this._vf.rotation.toMatrix()).
                mult(this._vf.scaleOrientation.toMatrix()).
                mult(x3dom.fields.SFMatrix4f.scale(this._vf.scale)).
                mult(this._vf.scaleOrientation.toMatrix().inverse()).
                mult(x3dom.fields.SFMatrix4f.translation(this._vf.center.negate()));
        },
        {
            fieldChanged: function (fieldName) {
                // P' = T * C * R * SR * S * -SR * -C * P
                this._trafo = x3dom.fields.SFMatrix4f.translation(this._vf.translation).
                            mult(x3dom.fields.SFMatrix4f.translation(this._vf.center)).
                            mult(this._vf.rotation.toMatrix()).
                            mult(this._vf.scaleOrientation.toMatrix()).
                            mult(x3dom.fields.SFMatrix4f.scale(this._vf.scale)).
                            mult(this._vf.scaleOrientation.toMatrix().inverse()).
                            mult(x3dom.fields.SFMatrix4f.translation(this._vf.center.negate()));
            }
        }
    )
);

// ### MatrixTransform ###
x3dom.registerNodeType(
    "MatrixTransform",
    "Grouping",
    defineClass(x3dom.nodeTypes.X3DTransformNode,
        function (ctx) {
            x3dom.nodeTypes.MatrixTransform.superClass.call(this, ctx);
            
            this.addField_SFMatrix4f(ctx, 'matrix', 1, 0, 0, 0,
                                                      0, 1, 0, 0,
                                                      0, 0, 1, 0,
                                                      0, 0, 0, 1);
            this._trafo = this._vf.matrix;
        },
        {
        }
    )
);

// ### Group ###
x3dom.registerNodeType(
    "Group",
    "Grouping",
    defineClass(x3dom.nodeTypes.X3DGroupingNode,
        function (ctx) {
            x3dom.nodeTypes.Group.superClass.call(this, ctx);
        },
        {
        }
    )
);

// ### Collision ###
x3dom.registerNodeType(
    "Collision",
    "Grouping",
    defineClass(x3dom.nodeTypes.X3DGroupingNode,
        function (ctx) {
            x3dom.nodeTypes.Collision.superClass.call(this, ctx);

			this.addField_SFBool (ctx, "enabled", true);
			this.addField_SFNode ("proxy", x3dom.nodeTypes.X3DGroupingNode);
			
			// TODO; add Slots: collideTime, isActive 
        },
        {
            collectDrawableObjects: function (transform, out)
            {
                for (var i=0; i<this._childNodes.length; i++) 
                {
                    if (this._childNodes[i] && (this._childNodes[i] !== this._cf.proxy.node)) 
                    {
                        var childTransform = this._childNodes[i].transformMatrix(transform);
                        this._childNodes[i].collectDrawableObjects(childTransform, out);
                    }
                }
            },
            
            doIntersect: function(line)
            {
                if (!this._vf.enabled) {
                    return false;
                }
                
                for (var i=0; i<this._childNodes.length; i++)
                {
                    if (this._childNodes[i]) {
                        if (this._childNodes[i].doIntersect(line)) {
                            return true;
                        }
                    }
                }
                return false;
            }
        }
    )
);

// ### X3DInterpolatorNode ###
x3dom.registerNodeType(
    "X3DInterpolatorNode",
    "Base",
    defineClass(x3dom.nodeTypes.X3DChildNode,
        function (ctx) {
            x3dom.nodeTypes.X3DInterpolatorNode.superClass.call(this, ctx);
            
            if (ctx.xmlNode.hasAttribute('key'))
                this._vf.key = Array.map(ctx.xmlNode.getAttribute('key').split(/\s+/), function (n) { return +n; });
            else
                this._vf.key = [];
        },
        {
            linearInterp: function (t, interp) {
                if (t <= this._vf.key[0])
                    return this._vf.keyValue[0];
                if (t >= this._vf.key[this._vf.key.length-1])
                    return this._vf.keyValue[this._vf.key.length-1];
                for (var i = 0; i < this._vf.key.length-1; ++i) {
                    if ((this._vf.key[i] < t) && (t <= this._vf.key[i+1])) {
                        return interp( this._vf.keyValue[i], this._vf.keyValue[i+1], 
                                (t - this._vf.key[i]) / (this._vf.key[i+1] - this._vf.key[i]) );
					}
				}
			    return this._vf.keyValue[0];
            }
        }
    )
);


// ### OrientationInterpolator ###
x3dom.registerNodeType(
    "OrientationInterpolator",
    "Interpolation",
    defineClass(x3dom.nodeTypes.X3DInterpolatorNode,
        function (ctx) {
            x3dom.nodeTypes.OrientationInterpolator.superClass.call(this, ctx);
            
            if (ctx.xmlNode.hasAttribute('keyValue'))
                this._vf.keyValue = x3dom.fields.MFRotation.parse(ctx.xmlNode.getAttribute('keyValue'));
            else
                this._vf.keyValue = [];
            
            this._fieldWatchers.fraction = this._fieldWatchers.set_fraction = [ function (msg) {
                var value = this.linearInterp(msg, function (a, b, t) { return a.slerp(b, t); });
                this.postMessage('value_changed', value);
            } ];
        }
    )
);

// ### PositionInterpolator ###
x3dom.registerNodeType(
    "PositionInterpolator",
    "Interpolation",
    defineClass(x3dom.nodeTypes.X3DInterpolatorNode,
        function (ctx) {
            x3dom.nodeTypes.PositionInterpolator.superClass.call(this, ctx);
            
            if (ctx.xmlNode.hasAttribute('keyValue'))
                this._vf.keyValue = x3dom.fields.MFVec3f.parse(ctx.xmlNode.getAttribute('keyValue'));
            else
                this._vf.keyValue = [];
            
            this._fieldWatchers.fraction = this._fieldWatchers.set_fraction = [ function (msg) {
                var value = this.linearInterp(msg, function (a, b, t) { return a.multiply(1.0-t).add(b.multiply(t)); });
                this.postMessage('value_changed', value);
            } ];
        }
    )
);

// ### ScalarInterpolator ###
x3dom.registerNodeType(
    "ScalarInterpolator",
    "Interpolation",
    defineClass(x3dom.nodeTypes.X3DInterpolatorNode,
        function (ctx) {
            x3dom.nodeTypes.ScalarInterpolator.superClass.call(this, ctx);
            
            if (ctx.xmlNode.hasAttribute('keyValue'))
                this._vf.keyValue = Array.map(ctx.xmlNode.getAttribute('keyValue').split(/\s+/), function (n) { return +n; });
            else
                this._vf.keyValue = [];
			
            this._fieldWatchers.fraction = this._fieldWatchers.set_fraction = [ function (msg) {
                var value = this.linearInterp(msg, function (a, b, t) { return (1.0-t)*a + t*b; });
                this.postMessage('value_changed', value);
            } ];
        }
    )
);

// ### CoordinateInterpolator ###
x3dom.registerNodeType(
    "CoordinateInterpolator",
    "Interpolation",
    defineClass(x3dom.nodeTypes.X3DInterpolatorNode,
        function (ctx) {
            x3dom.nodeTypes.CoordinateInterpolator.superClass.call(this, ctx);
            
            this._vf.keyValue = [];
            if (ctx.xmlNode.hasAttribute('keyValue')) {
                var arr = x3dom.fields.MFVec3f.parse(ctx.xmlNode.getAttribute('keyValue'));
                var key = this._vf.key.length > 0 ? this._vf.key.length : 1;
                var len = arr.length / key;
                for (var i=0; i<key; i++) {
                    var val = new x3dom.fields.MFVec3f();
                    for (var j=0; j<len; j++) {
                        val.push( arr[i*len+j] );
                    }
                    this._vf.keyValue.push(val);
                }
            }
            
            this._fieldWatchers.fraction = this._fieldWatchers.set_fraction = [ function (msg) {
                var value = this.linearInterp(msg, function (a, b, t) {
                    var val = new x3dom.fields.MFVec3f();
                    for (var i=0; i<a.length; i++) {
                        val.push(a[i].multiply(1.0-t).add(b[i].multiply(t)));
                    }
                    return val;
                });
                this.postMessage('value_changed', value);
            } ];
        }
    )
);

// ### X3DSensorNode ###
x3dom.registerNodeType(
    "X3DSensorNode",
    "Base",
    defineClass(x3dom.nodeTypes.X3DChildNode,
        function (ctx) {
            x3dom.nodeTypes.X3DSensorNode.superClass.call(this, ctx);
        }
    )
);

// ### TimeSensor ###
x3dom.registerNodeType(
    "TimeSensor",
    "Time",
    defineClass(x3dom.nodeTypes.X3DSensorNode,
        function (ctx) {
            x3dom.nodeTypes.TimeSensor.superClass.call(this, ctx);
            
			this.addField_SFBool(ctx, 'enabled', true);
            this.addField_SFTime(ctx, 'cycleInterval', 1);
            this.addField_SFBool(ctx, 'loop', false);
            this.addField_SFTime(ctx, 'startTime', 0);
    
            this._fraction = 0;
        },
        {
            onframe: function (ts) {
				if (!this._vf.enabled)
					return;
				
            	var isActive = ( ts >= this._vf.startTime);
            	var cycleFrac, cycle, fraction;
            	
            	if (this._vf.cycleInterval > 0) {
                    cycleFrac = (ts - this._vf.startTime) / this._vf.cycleInterval;
                    cycle = Math.floor(cycleFrac);
                    fraction = cycleFrac - cycle;
            	}
     
     			this.postMessage('fraction_changed', fraction );
            }
        }
    )
);


// Not a real X3D node type
// TODO; refactor to Scene + Viewarea node

// ### Scene ###
x3dom.registerNodeType( 
    "Scene",
    "Base",
    defineClass(x3dom.nodeTypes.X3DGroupingNode,
        function (ctx) {
            x3dom.nodeTypes.Scene.superClass.call(this, ctx);

			this._rotMat = x3dom.fields.SFMatrix4f.identity();
			this._transMat = x3dom.fields.SFMatrix4f.identity();
			this._movement = new x3dom.fields.SFVec3f(0, 0, 0);
            
			this._width = 400;
			this._height = 300;
            this._lastX = -1;
            this._lastY = -1;
            this._pick = new x3dom.fields.SFVec3f(0, 0, 0);
            
            this._ctx = ctx;    // needed for late create in onNodeInserted()
			this._cam = null;
            this._bgnd = null;
            this._navi = null;
			this._lights = [];
        },
        {
        	getViewpoint: function() 
            {
        		if (this._cam == null) 
                {
					this._cam = this.find(x3dom.nodeTypes.Viewpoint);
                    
                    if (!this._cam)
                    {
                        var nodeType = x3dom.nodeTypes["Viewpoint"];
                        this._cam = new nodeType();
                        x3dom.debug.logInfo("Created ViewBindable.");
                    }
                }
				
  				return this._cam;
        	},
			
			getLights: function() 
            {
				if (this._lights.length == 0)
					this._lights = this.findAll(x3dom.nodeTypes.DirectionalLight);
                //FIXME; need to check if number/ type of lights has changed, and use:
                //  this._lights = this.findAll(x3dom.nodeTypes.X3DLightNode);
				
				return this._lights;
			},
            
            getNavInfo: function()
            {
                if (this._navi == null)
                {
                    this._navi = this.find(x3dom.nodeTypes.NavigationInfo);
                    
                    if (!this._navi)
                    {
                        var nodeType = x3dom.nodeTypes["NavigationInfo"];
                        this._navi = new nodeType();
                        x3dom.debug.logInfo("Created UserBindable.");
                    }
                }
                
                return this._navi;
            },
        	
			getSceneVolume: function(min, max, invalidate)
			{
				var MIN = new x3dom.fields.SFVec3f(
					Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
				var MAX = new x3dom.fields.SFVec3f(
					Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
				
				var valid = this.getVolume(MIN, MAX, invalidate);
				
				min.x = MIN.x;
				min.y = MIN.y;
				min.z = MIN.z;
				
				max.x = MAX.x;
				max.y = MAX.y;
				max.z = MAX.z;
                
                return valid;
			},
			
            getViewpointMatrix: function () 
            {
                var viewpoint = this.getViewpoint();
                var mat_viewpoint = viewpoint.getCurrentTransform();
                
				return mat_viewpoint.mult(viewpoint.getViewMatrix());
            },
    
            getViewMatrix: function () 
            {
                return this.getViewpointMatrix().
							mult(this._transMat).
							mult(this._rotMat);
            },
            
            getLightMatrix: function()
            {
                var lights = this.getLights();
                if (lights.length > 0)
                {
                    var min = new x3dom.fields.SFVec3f(
                        Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
                    var max = new x3dom.fields.SFVec3f(
                        Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
                    var ok = this.getSceneVolume(min, max, true);
                    
                    if (ok)
                    {
                        var viewpoint = this.getViewpoint();
                        var fov = viewpoint.getFieldOfView();
                        
                        var dia = max.subtract(min);
                        var dist1 = (dia.y/2.0) / Math.tan(fov/2.0) + (dia.z/2.0);
                        var dist2 = (dia.x/2.0) / Math.tan(fov/2.0) + (dia.z/2.0);
                        
                        dia = min.add(dia.multiply(0.5));
                        //FIXME; lights might be influenced by a transformation
                        if (x3dom.isa(lights[0], x3dom.nodeTypes.PointLight)) {
                            dia = dia.subtract(lights[0]._vf.location).normalize();
                        }
                        else {
                            var dir = lights[0]._vf.direction.normalize().negate();
                            dia = dia.add(dir.multiply(1.2*(dist1 > dist2 ? dist1 : dist2)));
                        }
                        //x3dom.debug.logInfo(dia);
                        
                        //FIXME; need to return array for all lights
                        return lights[0].getViewMatrix(dia);
                    }
                }
                //TODO, this is only for testing
                return this.getViewMatrix();
            },
            
            getWCtoLCMatrix: function()
            {
                var view = this.getLightMatrix();
                var proj = this.getProjectionMatrix();
                
                return proj.mult(view);
            },
			
			getSkyColor: function() 
            {
                if (this._bgnd == null)
                {
                    this._bgnd = this.find(x3dom.nodeTypes.Background);
                    
                    if (!this._bgnd)
                    {
                        var nodeType = x3dom.nodeTypes["Background"];
                        this._bgnd = new nodeType();
                        x3dom.debug.logInfo("Created BackgroundBindable.");
                    }
                }
				
				var bgCol = this._bgnd.getSkyColor().toGL();
				//workaround; impl. skyTransparency etc.
				if (bgCol.length > 2)
					bgCol[3] = 1.0 - this._bgnd.getTransparency();
				
				return [bgCol, this._bgnd.getTexUrl()];
			},
            
            getProjectionMatrix: function() 
            {
                var viewpoint = this.getViewpoint();
                
				return viewpoint.getProjectionMatrix(this._width/this._height);
            },
            
            getWCtoCCMatrix: function()
            {
                var view = this.getViewMatrix();
                var proj = this.getProjectionMatrix();
                
                return proj.mult(view);
            },
            
            getCCtoWCMatrix: function()
            {
                var mat = this.getWCtoCCMatrix();
                
                return mat.inverse();
            },
            
            calcViewRay: function(x, y)
            {
                var cctowc = this.getCCtoWCMatrix();
                
                var rx = x / (this._width - 1.0) * 2.0 - 1.0;
                var ry = (this._height - 1.0 - y) / (this._height - 1.0) * 2.0 - 1.0;
                
                var from = cctowc.multFullMatrixPnt(new x3dom.fields.SFVec3f(rx, ry, -1));
                var at = cctowc.multFullMatrixPnt(new x3dom.fields.SFVec3f(rx, ry,  1));
                var dir = at.subtract(from);
                
                return new x3dom.fields.Line(from, dir);
            },
            
            showAll: function()
            {
				var min = new x3dom.fields.SFVec3f(
					Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
				var max = new x3dom.fields.SFVec3f(
					Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
                var ok = this.getSceneVolume(min, max, true);
                
                if (ok)
                {
                    var viewpoint = this.getViewpoint();
                    var fov = viewpoint.getFieldOfView();
                    
                    var dia = max.subtract(min);
                    var dist1 = (dia.y/2.0) / Math.tan(fov/2.0) + (dia.z/2.0);
                    var dist2 = (dia.x/2.0) / Math.tan(fov/2.0) + (dia.z/2.0);
                    
                    dia = min.add(dia.multiply(0.5));
                    dia.z += (dist1 > dist2 ? dist1 : dist2);
                    viewpoint.setView(x3dom.fields.SFMatrix4f.translation(dia.multiply(-1)));
                    
                    this._rotMat = x3dom.fields.SFMatrix4f.identity();
                    this._transMat = x3dom.fields.SFMatrix4f.identity();
                    this._movement = new x3dom.fields.SFVec3f(0, 0, 0);
                }
            },
            
            resetView: function()
            {
                this.getViewpoint().resetView();
                
                this._rotMat = x3dom.fields.SFMatrix4f.identity();
                this._transMat = x3dom.fields.SFMatrix4f.identity();
                this._movement = new x3dom.fields.SFVec3f(0, 0, 0);
            },
            
            onMousePress: function (x, y, buttonState)
            {
                this._lastX = x;
                this._lastY = y;
                
                var line = this.calcViewRay(x, y);
                
                var isect = this.doIntersect(line);
                
                if (isect) 
                {
                    this._pick.x = line.hitPoint.x;
                    this._pick.y = line.hitPoint.y;
                    this._pick.z = line.hitPoint.z;
                    x3dom.debug.logInfo("Ray hit at position " + this._pick);
                }
                else 
                {
                    var dir = this.getViewMatrix().e2().negate();
                    var u = dir.dot(line.pos.negate()) / dir.dot(line.dir);
                    this._pick = line.pos.add(line.dir.multiply(u));
                    //x3dom.debug.logInfo("No hit at position " + this._pick);
                }
            },
            
            onMouseRelease: function (x, y, buttonState)
            {
                this._lastX = x;
                this._lastY = y;
            },
            
            onDoubleClick: function (x, y)
            {
                var navi = this.getNavInfo();
                if (navi._vf.type[0].length <= 1 || navi._vf.type[0].toLowerCase() == "none")
                    return;
                
                var viewpoint = this.getViewpoint();
                
                viewpoint._vf.centerOfRotation.x = this._pick.x;
                viewpoint._vf.centerOfRotation.y = this._pick.y;
                viewpoint._vf.centerOfRotation.z = this._pick.z;
                x3dom.debug.logInfo("New center of Rotation:  " + this._pick);
            },
    		
            //ondrag: function (dx, dy, buttonState) 
            ondrag: function (x, y, buttonState) 
            {
                var navi = this.getNavInfo();
                if (navi._vf.type[0].length <= 1 || navi._vf.type[0].toLowerCase() == "none")
                    return;
                
                var Eps = 0.00001;
                var dx = x - this._lastX;
                var dy = y - this._lastY;
				var min, max, ok, d, vec;
                var viewpoint = this.getViewpoint();
				
				if (buttonState & 1) 
                {
					var alpha = (dy * 2 * Math.PI) / this._width;
					var beta = (dx * 2 * Math.PI) / this._height;
					var mat = this.getViewMatrix();
					
					var mx = x3dom.fields.SFMatrix4f.rotationX(alpha);
					var my = x3dom.fields.SFMatrix4f.rotationY(beta);
					
					var center = viewpoint.getCenterOfRotation();
					mat.setTranslate(new x3dom.fields.SFVec3f(0,0,0));
                    
					this._rotMat = this._rotMat.
									mult(x3dom.fields.SFMatrix4f.translation(center)).
									mult(mat.inverse()).
									mult(mx).mult(my).
									mult(mat).
									mult(x3dom.fields.SFMatrix4f.translation(center.negate()));
				}
				if (buttonState & 4) 
                {
					min = new x3dom.fields.SFVec3f(0,0,0);
					max = new x3dom.fields.SFVec3f(0,0,0);
					ok = this.getSceneVolume(min, max, true);
					
					d = ok ? (max.subtract(min)).length() : 10;
                    d = (d < Eps) ? 1 : d;
					//x3dom.debug.logInfo("PAN: " + min + " / " + max + " D=" + d);
					//x3dom.debug.logInfo("w="+this._width+", h="+this._height);
					
					vec = new x3dom.fields.SFVec3f(d*dx/this._width,d*(-dy)/this._height,0);
					this._movement = this._movement.add(vec);
                    
                    //TODO; move real distance along viewing plane
					this._transMat = viewpoint.getViewMatrix().inverse().
								mult(x3dom.fields.SFMatrix4f.translation(this._movement)).
								mult(viewpoint.getViewMatrix());
				}
				if (buttonState & 2) 
                {
					min = new x3dom.fields.SFVec3f(0,0,0);
					max = new x3dom.fields.SFVec3f(0,0,0);
					ok = this.getSceneVolume(min, max, true);
					
					d = ok ? (max.subtract(min)).length() : 10;
                    d = (d < Eps) ? 1 : d;
					//x3dom.debug.logInfo("ZOOM: " + min + " / " + max + " D=" + d);
					//x3dom.debug.logInfo((dx+dy)+" w="+this._width+", h="+this._height);
					
					vec = new x3dom.fields.SFVec3f(0,0,d*(dx+dy)/this._height);
					this._movement = this._movement.add(vec);
                    
                    //TODO; move real distance along viewing ray
					this._transMat = viewpoint.getViewMatrix().inverse().
								mult(x3dom.fields.SFMatrix4f.translation(this._movement)).
								mult(viewpoint.getViewMatrix());
				}
                
                this._lastX = x;
                this._lastY = y;
            }
        }
    )
);

// ### Anchor ###
x3dom.registerNodeType(
    "Anchor",
    "Networking",
    defineClass(x3dom.nodeTypes.X3DGroupingNode,
        function (ctx) {
            x3dom.nodeTypes.Anchor.superClass.call(this, ctx);
            
            this.addField_MFString(ctx, 'url', []);
        },
        {
            doIntersect: function(line) {
                var isect = false;
                for (var i=0; i<this._childNodes.length; i++) {
                    if (this._childNodes[i]) {
                        if (this._childNodes[i].doIntersect(line)) {
                            isect = true;
                        }
                    }
                }
                
                if (isect && this._vf.url.length > 0) {
                    // fixme; window.open usually gets blocked
                    // but this way the current page is lost?!
                    window.location = this._vf.url[0];
                }
                
                return isect;
            }
        }
    )
);

// ### Inline ###
x3dom.registerNodeType(
    "Inline",
    "Networking",
    defineClass(x3dom.nodeTypes.X3DGroupingNode,
        function (ctx) {
            x3dom.nodeTypes.Inline.superClass.call(this, ctx);
            
            this.addField_MFString(ctx, 'url', []);
            this.addField_SFBool(ctx, 'load', true);
            
            var that = this;
            
            var xhr = new XMLHttpRequest();
            xhr.overrideMimeType('text/xml');   //application/xhtml+xml
            
            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    if (xhr.responseXML.documentElement.localName == 'parsererror') {
                        x3dom.debug.logInfo('XML parser failed on '+this._vf.url+':\n'+xhr.responseXML.documentElement.textContent);
                        return;
                    }
                }
                else {
                    x3dom.debug.logInfo('Loading inlined data... (readyState: ' + xhr.readyState + ')');
                    //if (xhr.readyState == 3) x3dom.debug.logInfo(xhr.responseText);
                    return;
                }
                if (xhr.status !== 200) {
                    x3dom.debug.logError('XMLHttpRequest requires a web server running!');
                    return;
                }
                
                x3dom.debug.logInfo('Inline: downloading '+that._vf.url+' done.');
                
                var xml = xhr.responseXML;
                
                //TODO; check if exists and FIXME: it's not necessarily the first scene in the doc!
                var inlScene = xml.getElementsByTagName('Scene')[0] || xml.getElementsByTagName('scene')[0];
                //var inlScene = x3dom.findScene(xml);              // sceneDoc is the X3D element here...

				if (inlScene) {
					var nameSpace = new x3dom.NodeNameSpace();             
                	var newScene = nameSpace.setupTree(inlScene);
					that.addChild(newScene);
				}
				else {
					x3dom.debug.logInfo('no Scene in ' + xml.localName);
				}
				
				
				that.addChild(newScene);
				/*
                for (var i=0, n=newScene._childNodes.length; i<n; i++) {
                    that.addChild(newScene._childNodes[i]);
                }
                */
                
                x3dom.debug.logInfo('Inline: added '+that._vf.url+' to scene.');
            };
            
            x3dom.debug.logInfo('Inline: downloading '+this._vf.url);
            
            xhr.open('GET', this._vf.url, true);
            xhr.send(null);
        },
        {
            fieldChanged: function (fieldName) {
                // FIXME: Add 'url' update code
            }
        }
    )
);


/* ### END OF NODES ###*/

x3dom.X3DDocument = function(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.onload = function () {};
    this.onerror = function () {};
};

x3dom.X3DDocument.prototype.load = function (uri, sceneElemPos) {
    // Load uri. Get sceneDoc, list of sub-URIs.
    // For each URI, get docs[uri] = whatever, extend list of sub-URIs.

    var uri_docs = {};
    var queued_uris = [uri];
    var doc = this;
    
    function next_step() {
        // TODO: detect circular inclusions
        // TODO: download in parallel where possible

        if (queued_uris.length == 0) {
            // All done
            doc._setup(uri_docs[uri], uri_docs, sceneElemPos);
            doc.onload();
            return;
        }
        var next_uri = queued_uris.shift();
        
		//x3dom.debug.logInfo("loading... next_uri=" + next_uri + ", " + x3dom.isX3DElement(next_uri) + ", " + next_uri.namespaceURI);
        if (x3dom.isX3DElement(next_uri) && next_uri.localName.toLowerCase() == 'x3d') {
            // Special case, when passed an X3D node instead of a URI string
            uri_docs[next_uri] = next_uri;
            next_step();
        }
    }
	
    next_step();
};

x3dom.findScene = function(x3dElem) {
    var sceneElems = [];    
    for (var i=0; i<x3dElem.childNodes.length; i++) {
        var sceneElem = x3dElem.childNodes[i];        
        if (sceneElem && sceneElem.localName && sceneElem.localName.toLowerCase() === "scene") {
            sceneElems.push(sceneElem);
        }
    }
    
    if (sceneElems.length > 1) {
        x3dom.debug.logError("X3D element has more than one Scene child (has " + x3dElem.childNodes.length + ").");
    } else {
        return sceneElems[0];
    }
    return null;
};

x3dom.X3DDocument.prototype._setup = function (sceneDoc, uriDocs, sceneElemPos) {

    var doc = this;
    
    // Test capturing DOM mutation events on the X3D subscene
    var domEventListener = {
        onAttrModified: function(e) {
            var attrToString = {
                1: "MODIFICATION",
                2: "ADDITION",
                3: "REMOVAL"
            };
            //x3dom.debug.logInfo("MUTATION: " + e + ", " + e.type + ", attrChange=" + attrToString[e.attrChange]);
            e.target._x3domNode.updateField(e.attrName, e.newValue);
        },
        onNodeRemoved: function(e) {
            var parent = e.target.parentNode._x3domNode;
            var child = e.target._x3domNode;
            
            x3dom.debug.logInfo("Child: " + e.target.type + "MUTATION: " + e + ", " + e.type + ", removed node=" + e.target.tagName);
            
			parent.removeChild(child);
        },
        onNodeInserted: function(e) {
            var parent = e.target.parentNode._x3domNode;
            var child = e.target;
       
            //x3dom.debug.logInfo("MUTATION: " + e + ", " + e.type + ", inserted node=" + child.tagName);
            //x3dom.debug.logInfo("MUTATION: " + child.translation + ", " + child.parentNode.tagName);
                        
            //FIXME; get rid of scene._ctx

			if (parent._nameSpace) {
				var newNode = parent._nameSpace.setupTree (child);
				parent.addChild(newNode, child.getAttribute("containerField"));
			}
            else {
				x3dom.debug.logInfo("No _nameSpace in onNodeInserted");
			}
         }
    };
    
    //sceneDoc.addEventListener('DOMCharacterDataModified', domEventListener.onAttrModified, true);    
    sceneDoc.addEventListener('DOMNodeRemoved', domEventListener.onNodeRemoved, true);
    sceneDoc.addEventListener('DOMNodeInserted', domEventListener.onNodeInserted, true);
    sceneDoc.addEventListener('DOMAttrModified', domEventListener.onAttrModified, true);

    var sceneElem = x3dom.findScene(sceneDoc);              // sceneDoc is the X3D element here...
	var nameSpace = new x3dom.NodeNameSpace("scene");
    var scene = nameSpace.setupTree(sceneElem);

    this._scene = scene;
	
	// create view 
	this._scene._width = this.canvas.width;
	this._scene._height = this.canvas.height;
};

x3dom.X3DDocument.prototype.advanceTime = function (t) {
    if (this._scene) {
		// FIXME; link all TimeSensor in context
        Array.forEach(this._scene.findAll(x3dom.nodeTypes.TimeSensor),
            function (timer) { timer.onframe(t); }
        );
    }
};

x3dom.X3DDocument.prototype.render = function (ctx) {
    if (!ctx)
        return;
    ctx.renderScene(this._scene);
};

x3dom.X3DDocument.prototype.ondrag = function (x, y, buttonState) {
    this._scene.ondrag(x, y, buttonState);
};

x3dom.X3DDocument.prototype.onMousePress = function (x, y, buttonState) {
    this._scene.onMousePress(x, y, buttonState);
};

x3dom.X3DDocument.prototype.onMouseRelease = function (x, y, buttonState) {
    this._scene.onMouseRelease(x, y, buttonState);
};

x3dom.X3DDocument.prototype.onDoubleClick = function (x, y) {
    this._scene.onDoubleClick(x, y);
};

x3dom.X3DDocument.prototype.onKeyPress = function(charCode) 
{
    //x3dom.debug.logInfo("pressed key " + charCode);
    switch (charCode)
    {
        case  97: /* a, view all */ 
            {
                this._scene.showAll();
            }
            break;
        case 108: /* l, light view */ 
			{
                if (this._scene.getLights().length > 0)
                {
                    this._scene.getViewpoint().setView(this._scene.getLightMatrix());
                    this._scene._rotMat = x3dom.fields.SFMatrix4f.identity();
                    this._scene._transMat = x3dom.fields.SFMatrix4f.identity();
                    this._scene._movement = new x3dom.fields.SFVec3f(0, 0, 0);
                }
			}
			break;
        case 109: /* m, toggle "points" attribute */ 
			{
				if (this._scene._points === undefined)
					this._scene._points = true;
				else
					this._scene._points = !this._scene._points;
			}
			break;
        case 114: /* r, reset view */
            {
                this._scene.resetView();
            }
            break;
        default:
    }
};

x3dom.X3DDocument.prototype.shutdown = function(ctx)
{
    if (!ctx)
        return;
	ctx.shutdown(this._scene);
};
