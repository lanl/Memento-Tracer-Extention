/* jshint esversion:6 */
/* jshint strict: false */


/*
 * Copyright 2017 SideeX committers
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

class Recorder {

    constructor(window) {
        this.window = window;
        this.attached = false;
        this.frameLocation = this.getFrameLocation();
        /*
        browser.runtime.sendMessage({
            frameLocation: this.frameLocation
        }).catch(function(reason) {
            // Failed silently if receiving end does not exist
        });
        */
    }

    // This part of code is copyright by Software Freedom Conservancy(SFC)
    parseEventKey(eventKey) {
        if (eventKey.match(/^C_/)) {
            return { eventName: eventKey.substring(2), capture: true };
        } else {
            return { eventName: eventKey, capture: false };
        }
    }

    // This part of code is copyright by Software Freedom Conservancy(SFC)
    attach(events, eventId, eventType) {
        if (this.attached) {
            return;
        }
        this.attached = true;
        this.eventListeners = {};
        this.eventType = eventType;
        this.eventId = eventId;
        var self = this;

        for (let eventKey in Recorder.eventHandlers) {

            // console.log("eventKey: ");
            // console.log(eventKey);

            var eventInfo = this.parseEventKey(eventKey);
            var eventName = eventInfo.eventName;
            var capture = eventInfo.capture;

            // console.log("eventInfo: ");
            // console.log(eventInfo);

            // console.log("eventInfo.capture: ");
            // console.log(eventInfo.capture);

            if (events.indexOf(eventName) < 0) {
                return;
            }

            // create new function so that the variables have new scope.
            function register() {
                var handlers = Recorder.eventHandlers[eventKey];
                var listener = function(event) {
                    for (var i = 0; i < handlers.length; i++) {
                        handlers[i].call(self, event);
                    }
                }
                this.window.document.addEventListener(eventName, listener, capture);
                this.eventListeners[eventKey] = listener;
            }
            register.call(this);
        }
    }

    // This part of code is copyright by Software Freedom Conservancy(SFC)
    detach() {
        if (!this.attached) {
            return;
        }
        this.attached = false;
        for (let eventKey in this.eventListeners) {
            var eventInfo = this.parseEventKey(eventKey);
            var eventName = eventInfo.eventName;
            var capture = eventInfo.capture;
            this.window.document.removeEventListener(eventName, this.eventListeners[eventKey], capture);
        }
        delete this.eventListeners;
        $(".highlighter").remove();
    }

    showMouseOverBox(event) {
        let overlay = $(".highlighter");
        if (event.target === document.body) {
            overlay.hide();
            return;
        }
        if (event.target) {
            let tgt = $(event.target);

            let offset = tgt.offset();
            let width = tgt.outerWidth();
            let height = tgt.outerHeight();

            overlay.css({
                top: offset.top,
                left: offset.left,
                width: width,
                height: height
            }).show();
        }
    }

    getFrameLocation() {
        let currentWindow = window;
        let currentParentWindow;
        let frameLocation = "";
        while (currentWindow !== window.top) {
            currentParentWindow = currentWindow.parent;
            for (let idx = 0; idx < currentParentWindow.frames.length; idx++)
                if (currentParentWindow.frames[idx] === currentWindow) {
                    frameLocation = ":" + idx + frameLocation;
                    currentWindow = currentParentWindow;
                    break;
                }
        }
        return frameLocation = "root" + frameLocation;
    }

    readFromStorage(event) {
        return new Promise( (resolve, reject) => {
            chrome.storage.local.get(null, function(items) {
                resolve([items, event]); 
            });
        });
    }

    getElementByXPath(path) {
        for (let p of path) {
            if (document.evaluate(p, document, null, XPathResult. FIRST_ORDERED_NODE_TYPE, null).singleNodeValue !== null) {
                return true;
            }
        }
        return false;
    }

    getXPath(node) {
        if (node.id && node.id !== "") {
            return ['id("' + node.id + '")'];
        }
        if (node == document.body) {
            return [node.tagName];
        }

        var ix = 0;
        try {
            var siblings = node.parentNode.childNodes;
        }
        catch (error) {
            return null;
        }
        let xp = [];
        for (var i=0, sibling; sibling=siblings[i]; i++) {
            if (sibling === node) {
                if (node.tagName.toLowerCase() == "a") {
                    xp.push("//" + node.tagName + '[text()="' + node.text + '"]');
                }
                xp.push(this.getXPath(node.parentNode) + "/" + node.tagName + "[" + (ix + 1) + "]");
                return xp;
            }
            if (sibling.nodeType === 1 && sibling.tagName === node.tagName) {
                ix++;
            }
        }
    }

    getParentBlock(node, parentTag) {
        // for now only looks for closest enclosing parent table
        if (!parentTag || parentTag === "" || parentTag === undefined) {
            parentTag = "table";
        }
        var tgt_table_parent = $(node).parents(parentTag);
        return (tgt_table_parent.length > 0) ? tgt_table_parent[0] : node;
    }

    getCSSSelector(node) {
        if (!node.nodeName) {
            return;
        }
        let sels = [];
        var selector = node.nodeName.toLowerCase();
        if (node.id) {
            sels.push(selector + '#' + node.id);

        }
        if (node.classList.length > 0) {
            let cls_sel = selector;
            for (var i=0, cls; cls=node.classList[i]; i++) {
                cls_sel += "." + cls.trim();
            }
            sels.push(cls_sel);
        }
        if (sels.length === 0) {
            sels.push(selector)
        }
        return sels;
    }

    selectorReturnsUniqueElement(selector, path) {
        var ele = document.querySelectorAll(selector);
        if (!path) {
            return true;
        }
        var xele = this.getElementByXPath(path);
        if (ele.length == 1 || !xele) {
            return true;
        }
        else {
            return false;
        }
    }

    getElementSelectors(event) {

        var selectors = {};
        selectors.elementSelectors = [];

        var top = event.pageY,
        left = event.pageX;
        var element = event.target;
        do {
            top -= element.offsetTop;
            left -= element.offsetLeft;
            element = element.offsetParent;
        } while (element);

        selectors.position = left + "," + top;

        var target = event.target;
        if (this.eventType === "select_all_links") {
            target = this.getParentBlock(target);
        }
        var baseURI = target.baseURI;

        var paths = this.getXPath(target);

        var selCount = 0;

        var sels = this.getCSSSelector(target);
        for (let sel of sels) {

            if (this.eventType === "select_all_links") {
                sel += " a";
            }
            let matchedElements = document.querySelectorAll(sel);
            selectors.elementSelectors.push({
                "selector": sel,
                "selectorType": "CSSSelector",
                "selectorOrder": selCount++,
                "selectorPreferred": true,
                "selectorMatches": matchedElements.length
            });
        }

        for (var i of paths) {
            if (this.eventType === "select_all_links") {
                i += "//a";
            }
            let matchedCount = 0;
            try {
                let res = document.evaluate(i,
                    document,
                    null,
                    XPathResult.ANY_TYPE,
                    null);
                while (res.iterateNext()) {
                    matchedCount++;
                }
            }
		    catch (e) {}
            selectors.elementSelectors.push({
                "selector": i,
                "selectorType": "XPath",
                "selectorOrder": selCount++,
                "selectorPreferred": false,
                "selectorMatches": matchedCount
            });
        }

        selectors.eventId = this.eventId;
        return selectors;
    }

    record(event, event_type) {
        if (event_type !== "click") {
            return;
        }
        //let self = this;
        var eve = {};
        /*
        DO NOT DELETE!!! Original Selenium JSON.
        eve[baseURI] = {
            command: command,
            target: target,
            value: value,
            insertBeforeLastCommand: insertBeforeLastCommand,
            frameLocation: (actualFrameLocation != undefined ) ? actualFrameLocation : this.frameLocation,
        };
        */
        /*
        this.readFromStorage(event)
        .then(this.getElementSelectors)
        .then(this.serializeToTracerJSON)
        .then( (events) => {
            chrome.storage.local.set(events);
        });
        */
        let selectors = this.getElementSelectors(event);

        let val = {};
        let msgName = "clickedSelector";
        console.log("event Type is " + this.eventType);
        if (this.eventType === "total_pages") {
            msgName = "totalPages";
        }
        if (this.eventType === "end_element") {
            msgName = "endElement";
        }

        val[msgName] = {
            "chosenSelectors": selectors,
            "frameIndex": this.frameLocation,
            "eventType": this.eventType,
            "detachRecorder": true
        };
        chrome.storage.local.set(val);
        /*
        chrome.runtime.sendMessage({
            "chosenSelectors": selectors,
            "frameIndex": this.frameLocation
        });

        chrome.runtime.sendMessage({detachRecorder: true});
        */
        //recorder.detach();
    }
}

Recorder.eventType = null;
Recorder.prev = null;

Recorder.eventHandlers = {};
Recorder.addEventHandler = function(handlerName, eventName, handler, options) {

    // console.log("adding EventHandler for:");
    // console.log("handlerName: ");
    // console.log(handlerName);
    // console.log("eventName: ");
    // console.log(eventName);
    // console.log("handler: ");
    // console.log(handler);
    // console.log("options:");
    // console.log(options);
    // console.log("this.eventHandlers:");
    // console.log(this.eventHandlers);

    handler.handlerName = handlerName;
    if (!options) options = false;
    let key = options ? ('C_' + eventName) : eventName;
    if (!this.eventHandlers[key]) {
        this.eventHandlers[key] = [];
    }
    this.eventHandlers[key].push(handler);
}


// TODO: new by another object
var recorder = new Recorder(window);

