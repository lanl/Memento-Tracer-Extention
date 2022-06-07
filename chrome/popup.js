/* jshint esversion:6 */
/* jshint strict: false */


/*
 * This class defines the Trace.
 *
 * This class initiates the properties of a trace and
 * implements the common methods when working with a trace.
 */
class Trace {
    /*
    This constructor initializes the trace object with
    required properties.
     */
    constructor(traceName=null) {
        this.traceName = (!traceName) ? "" : traceName;
        this._actions = {};
        this._locationUrls = {};
        this.uriPattern = "";
        this.uriRegex = "";
    }

    set locationUrls(locationUrl) {
        this._locationUrls[locationUrl] = locationUrl;
    }

    get locationUrls() {
        return this._locationUrls;
    }

    /*
     * Adds a child TracerEvent instance to an existing trace.
     * This method will get the input event's parent id,
     * find the parent from the trace and add the new TracerEvent
     * as a child of this parent event.
     */
    addTracerEvent(tracerEvent) {
        if (!this._actions) {
            this._actions = {};
        }
        if (!tracerEvent) {
            return false;
        }
        let parentId = tracerEvent.parentId;
        if (!parentId) {
            return false;
        }
        if (Object.keys(this._actions).length === 0) {
            this._actions[tracerEvent.id] = tracerEvent;
            return true;
        }
        let parentTracerEvent = this.getTracerEvent(parentId);
        if (parentTracerEvent) {
            parentTracerEvent.children[tracerEvent.id] = tracerEvent;
            return true;
        }
        return false;
    }

    /*
     * Given an event ID, this method will traverse the tree and return
     * the corresponding TracerEvent object. This performs a breadth first
     * search recursively.
     */
    getTracerEvent(eventId, actions=this._actions, existingQueue=null) {
        let queue = [];
        if (existingQueue && existingQueue.length > 0) {
            queue.push.apply(queue, existingQueue);
        }
        for (let eventId in actions) {
            queue.push(actions[eventId]);
        }
        while (queue.length > 0) {
            let currentEvent = queue.shift();
            if (currentEvent.id === eventId) {
                return currentEvent;
            }
            else {
                return this.getTracerEvent(eventId, actions=currentEvent.children, existingQueue=queue);
            }
        }
        return null;
    }

    /*
     * This method returns the shortest path to an event as an array in the trace.
     * The event is identified by the eventId passed as the parameter.
     */
    getShortestPath(eventId) {
        let path = [];
        let stack = [];
        //let visited = [];

        for (let eid in this._actions) {
            stack.push(this._actions[eid]);
        }
        let startingResourceId = stack[0].id;

        while (stack.length > 0) {
            let currentEvent = stack.pop();
            //visited.push(currentEvent.id);

            if (currentEvent.id !== eventId && Object.keys(currentEvent.children).length === 0) {
                path = [];
                continue;
            }

            path.push(currentEvent.id);
            if (currentEvent.id === eventId) {
                if (path[0] !== startingResourceId) {
                    path.unshift(startingResourceId);
                }
                return path.join(".");
            }
            else {
                for (let eid in currentEvent.children) {
                    stack.push(currentEvent.children[eid]);
                }
            }
        }
        return null;
    }

    /*
     * Deletes an event by eventId. Uses the getShortestPath method
     * to find the path to the TracerEvent with the eventId and then
     * follows this path to navigate down the tree and delete the
     * event.
     */
    deleteEvent(eventId) {
        let path = this.getShortestPath(eventId);
        if (!path) {
            return false;
        }
        let paths = path.split(".");
        let currentEvent = this._actions[paths.shift()];

        while (paths.length > 1) {
            currentEvent = currentEvent.children[paths.shift()];
        }
        // JS wouldn't delete a top level variable, so we are deleting
        // at one property deep.
        // for eg: delete a["asdsdfdgs"] instead of delete a
        delete currentEvent.children[paths.shift()];
        return true;
    }

    get actions() {
        return this._actions;
    }

    static browserInfo() {
        return {
            "userAgent": navigator.userAgent,
            "resourceUrl": Trace.getResourceUrlFromStorage()
        };
    }

    /*
     * Gets the current URL for a trace from the extension storage.
     */
    static getResourceUrlFromStorage() {
        getStoredEvents().then( (items) => {
            return items[1];
        });
    }

    /*
     * Converts the trace object to JSON serialized string.
     */
    toJSON() {
        let traceJson = [];
        traceJson.push('"traceName": ' + JSON.stringify(this.traceName, null, 2));
        if (this.uriPattern) {
            traceJson.push('"uriPattern": ' + JSON.stringify(this.uriPattern, null, 2));
        }
        else {
            traceJson.push('"uriPattern": ""');
        }
        if (this.uriRegex) {
            traceJson.push('"uriRegex": ' + JSON.stringify(this.uriRegex, null, 2));
        }
        else {
            traceJson.push('"uriRegex": ""');
        }
        traceJson.push('"actions": ' + JSON.stringify(this.actions, null, 2));
        return "{\n" + traceJson.join(",") + "\n}";
    }

    /*
     * Converts an existing trace from JSON string to a trace object.
     */
    static fromJSON(traceJson) {
        if (typeof(traceJson) == "string") {
            traceJson = JSON.parse(traceJson);
        }
        if (!traceJson) {
            return;
        }
        let trace = new Trace(traceJson.traceName);
        trace.uriPattern = traceJson.uriPattern;
        trace.uriRegex = traceJson.uriRegex;

        //for (let lUrl of traceJson.locationUrls) {
        //	trace.locationUrls = lUrl;
        //}
        let actions = [];
        for (let eventId in traceJson.actions) {
            actions.push(traceJson.actions[eventId]);
        }

        while(actions.length > 0) {
            let event = actions.pop();
            let tracerEvent = new TracerEvent(
                event.name,
                event.actionName,
                event.locationUrl,
                event.parentId,
                event.id,
                event.eventOrder
            );
            tracerEvent.selectors = event.selectors;
            tracerEvent.frameIndex = event.frameIndex;

            tracerEvent.repeat = event.repeat;

            trace.addTracerEvent(tracerEvent);
            for (let eventId in event.children) {
                actions.push(event.children[eventId]);
            }
        }
        return trace;
    }
}


/*
 * This class defines properties that define an event in a trace.
 * This is every event node in the trace tree.
 */
class TracerEvent {
    /*
     * Initializes the properties.
     */
    constructor(eventName=null, actionName=null, resourceUrl=null, parentId=null, eventId=null, eventOrder=null) {
        TracerEvent.eventCount += 1;
        this.id = (!eventId) ? this.createEventID() : eventId;
        this.default_name_set = false;

        if (eventName === null) {
            this.name = "Event " + TracerEvent.eventCount.toString();
            this.default_name_set = true;
        } else {
            this.name = eventName;
        }

        this.actionName = (!actionName) ? "click" : actionName;
        this.selectors = [];
        this.parentId = (!parentId) ? this.id : parentId;
        let resUrl = (!resourceUrl) ? Trace.getResourceUrlFromStorage() : resourceUrl;
        this.locationUrl = resUrl;
        this.children = {};
        this.eventOrder = (!eventOrder) ? TracerEvent.eventCount : eventOrder;
        this.repeat = {};
        this.frameIndex = "";
    }

    /*
     * Returns a TracerEvent instance as a dictionary.
     */
    get info() {
        let event = {};
        event.id = this.id;
        event.name = this.name;
        event.actionName = this.actionName;
        event.actionApply = this.actionApply;
        event.selector = this.selector;
        event.parentId = this.parentId;
        event.uriPattern = this.uriPattern;
        event.locationUrl = this.locationUrl;
        event.children = this.children;
        event.eventOrder = this.eventOrder;
        event.repeat = this.repeat;
        event.frameIndex = this.frameIndex;
        event.default_name_set = this.default_name_set;
        return event;
    }

    /*
     * Creates a random id string for each tracer event.
     */
    createEventID() {
        return TracerEvent.eventCount.toString() + Math.random().toString(16).slice(2);
    }

    updateEventName(newEventName) {
        event.name = newEventName;
        this.default_name_set = false;
    }
}


/*
 * ---------------------------------------------------------------------------------------
 * Helper functions to create Tracer, EventTracer instances and some misc functions
 * ---------------------------------------------------------------------------------------
 */
function createNewEventMetadata(parentId) {
    let event = new TracerEvent(eventName=null,
        actionName="click",
        resourceUrl=null,
        parentId=parentId);
    tempNewEvents[event.id] = event;
    return event.info;
}

function createStartingResourceTrace(resUrl) {
    TracerEvent.eventCount = 0;
    let event = new TracerEvent(eventName="Starting Resource",
        actionName="load",
        resourceUrl=resUrl);
    trace.addTracerEvent(event);
    return trace;
}


/*
 * Computes the width of an event button in the main UI depending
 * on the depth of that event in the tree.
 */
function getWidthForEvent(event, depth) {
    let insetWidth = 10;
    return "w-" + (100-(depth * insetWidth)).toString();
}

/*
 * Sorts the events by the order in which they were originally created.
 * This is used when opening a URL that the extension already has a trace
 * saved locally and the extension will display the events in the same order
 * as when the events were created. The TracerEvent has a property called
 * eventOrder that stores this event order.
 */
function getActionsByEventOrder(actions) {
    let tempActions = {};
    let sortedEvents = [];
    let eventIds = Object.keys(actions);
    for (let eventId of eventIds) {
        let currEvent = actions[eventId];
        tempActions[currEvent.eventOrder] = currEvent;
    }

    function compareNumbers(a, b) {
        return b-a;
    }
    let eventOrder = Object.keys(tempActions).sort(compareNumbers);

    for (let eo of eventOrder) {
        sortedEvents.push(tempActions[eo]);
    }
    return sortedEvents;
}

/*
 * Promisifying the extension's database retrieval, which is an
 * asynchronous operation. This helps write readable and non-nested
 * code.
 */
function getItemsFromStorage() {
    return new Promise( (resolve, reject) => {
        chrome.storage.local.get(null, function(items) {
            chrome.tabs.query({ active: true }, function(tabs) {

                for (i = 0; i < tabs.length; i++) {

                    if (tabs[i].url != chrome.runtime.getURL("popup.html")) {
                        var resource_url = tabs[i].url;
                        let value = {};
                        let copiedTrace = null;

                        if (items.hasOwnProperty(resource_url)) {
                            value = items[resource_url];
                        }
                        if (items.hasOwnProperty("copiedTrace") && items["copiedTrace"] !== null) {
                            copiedTrace = items["copiedTrace"];
                        }
                        resolve([value, resource_url, copiedTrace]);
                        break;
                    }
                }
            });
        });
    });
}

/*
 * Updates the temporarily created TracerEvent object with the
 * selector info when the user selects an element.
 *
 * The tempNewEvents helps store the event details until the user
 * hits the "Save" button and the event is stored permanently.
 */
function updateEvent(selectors, frameIndex) {
    let eventId = selectors.eventId;
    if (!tempNewEvents.hasOwnProperty(eventId)) {
        return false;
    }
    tempNewEvents[eventId].selectors = selectors.elementSelectors;
    tempNewEvents[eventId].id = eventId;
    tempNewEvents[eventId].frameIndex = frameIndex;
    return tempNewEvents[eventId];
}

// caching the aysnc storage lookup.
// from https://stackoverflow.com/questions/31709987/caching-javascript-promise-results
function cache(fn) {
    var NO_RESULT = {};
    var res = NO_RESULT;
    return function() {
        if (res === NO_RESULT) {
            return (res = fn.apply(this, arguments));
        }
        return res;
    };
}

/*
 * Converts the user entered url pattern into regular expressions that
 * is compatible across programing languages.
 */
function createRegExpForPattern(patternUrl) {
    let uriParts = patternUrl.split("?");

    //let urlRegExp = uriParts[0].replace(/\[(.*?)\]/g, "([^\/]+?)");
    let urlRegExp = uriParts[0].replace(/\[\[(.*?)\]\]/g, "(.+?)");
    urlRegExp = urlRegExp.replace(/\[(.*?)\]/g, "([^\/]+?)");

    //if (urlRegExp.endsWith("]+?)") && !uriParts[1]) {
    //	urlRegExp += "?(/$|$)";
    //}
    if (uriParts[1]) {
        urlRegExp += "\\?";
        let urlParams = "";

        if (uriParts[1].search("\\[\\[") >= 0) {
            urlParams = uriParts[1].replace(/\[\[(.*?)\]\]/g, "(.+?)");
        }
        else if (uriParts[1].search("\\[") >= 0) {
            urlParams = uriParts[1].replace(/\[(.*?)\]/g, "(.+?)?(&|$)");
        }
        else {
            urlParams = uriParts[1];
        }
        urlRegExp += urlParams;
    }
    urlRegExp += "$";
    return urlRegExp;
}


/*
 * ---------------------------------------------------------------------------------------
 * Helper functions to create the main extension UI
 * ---------------------------------------------------------------------------------------
 */

/*
 * Creates the menu choices for the high-level event types
 * that the extension currently supports: click, select all links in an area,
 * and scroll.
 */
function createEventTypeChoices(event_id, action_type, asStr=true) {
    let modal = [];
    modal.push('<div class="form-group">');
    modal.push('<label for="action_type_' + event_id +'">Type</label>');
    modal.push('<select class="form-control form-control-sm" id="action_type_' + event_id + '" required>');
    if (action_type === "click") {
        modal.push('<option value="action_type_click_'+event_id+'" selected>Click</option>');
    }
    else {
        modal.push('<option value="action_type_click_'+event_id+'">Click</option>');
    }
    if (action_type === "select_all_links") {
        modal.push('<option value="action_type_select_all_links_'+event_id+'" selected>Click All Links in an Area</option>');
    }
    else {
        modal.push('<option value="action_type_select_all_links_'+event_id+'">Click All Links in an Area</option>');
    }
    if (action_type === "scroll") {
        modal.push('<option value="action_type_scroll_'+event_id+'" selected>Scroll</option>');
    }
    else {
        modal.push('<option value="action_type_scroll_'+event_id+'">Scroll</option>');
    }

    if (action_type === "hover") {
        modal.push('<option value="action_type_hover_'+event_id+'" selected>Hover</option>');
    }
    else {
        modal.push('<option value="action_type_hover_'+event_id+'">Hover</option>');
    }

    // if (action_type === "clickandback" ) {
    //     modal.push('<option value="action_type_clickandback_'+event_id+'" selected>Click and Back</option>');
    // }
    // else {
    //     modal.push('<option value="action_type_clickandback_'+event_id+'">Click and Back</option>');
    // }

    // if (action_type === "clickandback" ) {
    //     modal.push('<option value="action_type_multiclick_'+event_id+'" selected>Multi-Click</option>');
    // }
    // else {
    //     modal.push('<option value="action_type_multiclick_'+event_id+'">Multi-Click</option>');
    // }

    modal.push('</select>');

    modal.push('</div>');
    if (asStr) {
        return modal.join("");
    }
    else {
        return modal;
    }
}

/*
 * ---------------------------------------------------------------------------------------
 * UI for Multi Conditions
 * ---------------------------------------------------------------------------------------
 */
/*
 * Creates html to list the exit conditions when the
 * recursive click option is chosen.
 */
function createClickMultiCondition(event_id, asStr=true) {
    let modal = [];
    modal.push('<div class="header">End Condition</div>');
    modal.push('<div class="form-group">');

    modal.push('<div class="row">');
    modal.push('<div class="col">');
    modal.push('<div id="multiclick_selector">');
    modal.push('<div class="input-group">');
    modal.push('<div class="input-group-prepend">');
    modal.push('<div class="input-group-text">');
    modal.push('<input type="radio" value="element-to-be-clicked" name="multi_condition_' + event_id + '" checked />');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('<span class="form-control form-control-sm">Select Element to be Clicked</span>');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('</div>');

    modal.push('<div class="row">');
    modal.push('<div class="col">');
    modal.push('<div id="maximum_number_element_area">');
    modal.push('<button type="button" class="btn btn-xs btn-info" style="font-size: small; margin: 10px 10px;" ' + 'id="end_element_' + event_id + '">' +
    'Choose element</button>');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('</div>');

    modal.push('<div class="row">');
    modal.push('<div class="col">');
    modal.push('<div class="input-group">');
    modal.push('<div class="input-group-prepend">');
    modal.push('<div class="input-group-text">');
    modal.push('<input type="radio" value="click-back-button" name="multi_condition_' + event_id + '" />');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('<span class="form-control form-control-sm">Click Browser Back Button</span>');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('</div>');

    modal.push('</div>');

    if (asStr) {
        return modal.join("");
    }
    else {
        return modal;
    }


}

/*
 * ---------------------------------------------------------------------------------------
 * UI for various Exit Conditions
 * ---------------------------------------------------------------------------------------
 */
/*
 * Creates html to list the exit conditions when the
 * recursive click option is chosen.
 */
function createClickExitCondition(event_id, asStr=true) {
    let modal = [];
    modal.push('<div class="header">Exit Condition</div>');
    modal.push('<div class="form-group">');

    modal.push('<div class="row">');
    modal.push('<div class="col">');
    modal.push('<div id="total_pages_selector">');
    modal.push('<div class="input-group">');
    modal.push('<div class="input-group-prepend">');
    modal.push('<div class="input-group-text">');
    modal.push('<input type="radio" value="element-with-selected-number" name="exit_condition_' + event_id + '" checked />');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('<span class="form-control form-control-sm">Element With Selected Number is Reached</span>');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('</div>');

    modal.push('<div class="row">');
    modal.push('<div class="col">');
    modal.push('<div id="maximum_number_element_area">');
    modal.push('<button type="button" class="btn btn-xs btn-info" style="font-size: small; margin: 10px 10px;" ' + 'id="choose_total_pages_' + event_id + '">' +
    'Choose element</button>');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('</div>');

    modal.push('<div class="row">');
    modal.push('<div class="col">');
    modal.push('<div id="user_number_total_pages_selector">');
    modal.push('<div class="input-group">');
    modal.push('<div class="input-group-prepend">');
    modal.push('<div class="input-group-text">');
    modal.push('<input type="radio" value="user-supplied-number" name="exit_condition_' + event_id + '" />');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('<span class="form-control form-control-sm">Until <input type="text" name="user-supplied-number-value" size="6" id="user_supplied_number_value' + event_id + '"> (< 100) Pages Are Reached</span>');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('</div>');

    modal.push('<div class="row">');
    modal.push('<div class="col">');
    modal.push('<div class="input-group">');
    modal.push('<div class="input-group-prepend">');
    modal.push('<div class="input-group-text">');
    modal.push('<input type="radio" value="no-more-pages" name="exit_condition_' + event_id + '" />');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('<span class="form-control form-control-sm">There Are No More Pages</span>');
    modal.push('</div>');
    modal.push('</div>');
    modal.push('</div>');

    modal.push('</div>');

    if (asStr) {
        return modal.join("");
    }
    else {
        return modal;
    }


}

/*
 * Creates html to list the exit condition for scrolling.
 */
function createScrollExitCondition(event_id, asStr=true) {
    let modal = [];
    //modal.push('<div class="card mb-3">');
    modal.push('<div class="header">Exit Condition</div>');
    //modal.push('<div class="card-body">');
    modal.push('<div id="scroll_exit_condition_' + event_id + '" class="form-group">');
    modal.push('<div class="input-group"><div class="input-group-prepend">');
    //modal.push('<span class="form-control form-control-sm" style="font-size: small;">Scroll</span>');
    modal.push('<input type="text" id="scroll_until_num_' + event_id + '" value="1" size="3" class="form-control-sm input-group-prepend" />');
    modal.push('</div>');
    modal.push('<span class="form-control form-control-sm" style="font-size: small;">viewport(s), leave blank for maximum scrolling.</span>');
    modal.push('</div>');

    modal.push('</div>');
    //modal.push('</div>');
    //modal.push('</div>');
    if (asStr) {
        return modal.join("");
    }
    else {
        return modal;
    }
}

/*
 * Creates a table that shows the selector that would matches the value for
 * the Max number of pages to crawl.
 */
function createSelectorTableForExitCondition(selectorInfo, eventId, readonly=false) {

    let selector = [];
    let order = 2;
    for (let sel of selectorInfo) {
        order++;

        // console.log("####");
        // console.log("eventId = " + eventId);
        // console.log("order = " + order);
        // console.log("####");

        selector.push('<div class="row">');
        selector.push('<div class="col-11 offset-1">');
        selector.push('<div id="selector_exit_condition_' + eventId + "_" + order + '" class="input-group">');
        selector.push('<div class="input-group-prepend"><div class="input-group-text">');
        selector.push('<input type="radio" label="'+ sel.selector.replace(/"/g, '&quot;') +'" value="' + order + '" name="selector_exit_condition_' + eventId + '"');
        if (sel.selectorPreferred) {
            selector.push("checked");
        }
        else if (!sel.selectorPreferred && readonly) {
            selector.push('disabled');
        }
        selector.push(' />');
        selector.push('</div>');
        selector.push('</div>');
        selector.push('<span class="form-control form-control-sm">' +
            'Number specified by element at ' + sel.selectorType + ' - ' + sel.selector + '</span>');
        selector.push('</div>');
        selector.push('</div>');
        selector.push('</div>');
    }
    return selector.join("");
}

/*
 * Creates a table that shows the selector that would matches the value for
 * the Max number of pages to crawl.
 */
function createSelectorTableForExitCondition(selectorInfo, eventId, readonly=false) {

    let selector = [];
    let order = 2;
    for (let sel of selectorInfo) {
        order++;

        // console.log("####");
        // console.log("eventId = " + eventId);
        // console.log("order = " + order);
        // console.log("####");

        selector.push('<div class="row">');
        selector.push('<div class="col-11 offset-1">');
        selector.push('<div id="selector_exit_condition_' + eventId + "_" + order + '" class="input-group">');
        selector.push('<div class="input-group-prepend"><div class="input-group-text">');
        selector.push('<input type="radio" label="'+ sel.selector.replace(/"/g, '&quot;') +'" value="' + order + '" name="selector_exit_condition_' + eventId + '"');
        if (sel.selectorPreferred) {
            selector.push("checked");
        }
        else if (!sel.selectorPreferred && readonly) {
            selector.push('disabled');
        }
        selector.push(' />');
        selector.push('</div>');
        selector.push('</div>');
        selector.push('<span class="form-control form-control-sm">' +
            'Number specified by element at ' + sel.selectorType + ' - ' + sel.selector + '</span>');
        selector.push('</div>');
        selector.push('</div>');
        selector.push('</div>');
    }
    return selector.join("");
}

/*
 * Handles the creation of the UI when the selector that
 * matches the max pages to crawl exit condition is available.
 * This method populates the existing exit condition table with
 * the new selector info.
 */
function updateExitCondition(selectors) {
    const event = new TracerEvent();
    event.id = selectors.eventId;
    let eventId = event.id;
    event.selectors = selectors.elementSelectors;
    // let selectorEle = $("#total_pages_selector");
    let selectorEle = $("#maximum_number_element_area");
    let selectorUI = createSelectorTableForExitCondition(event.selectors, eventId);
    selectorEle.html(selectorUI);
    attachExitSelectorMouseOverEvents(event);
}

/*
 * Creates a table that shows the various selectors options that the user has
 * chosen. A single click can produce multiple selectors for CSS selector, xpath, etc.
 */
function createSelectorTable(selectorInfo, eventId, readonly=false, savedSelectors=null) {

    let selector = [];
    selector.push('<label>Selector Choice</label>');

    selector.push('<table class="table" style="table-layout: fixed; font-size:0.8rem;">');
    selector.push('<thead>');
    selector.push('<tr>');
    selector.push('<th class="w-25" scope="col">Type</th>');
    selector.push('<th scope="col">Value</th>');
    selector.push('<th scope="col">Matches</th>');
    selector.push('</tr>');
    selector.push('</thead>');
    selector.push('<tbody>');
    let i = 0;
    for (let sel of selectorInfo) {
        selector.push('<tr id="selector_info_'+eventId+'_'+sel.selectorOrder+'">');
        selector.push('<td title="Choose Preference"><input type="radio" value="'+sel.selectorOrder+'" name="selector_info_preference_' + eventId + '" ');
        if (sel.selectorPreferred) {
            selector.push("checked");
        }
        else if (!sel.selectorPreferred && readonly) {
            selector.push('disabled');
        }
        selector.push(' /></td>');
        selector.push('<td scope="text-truncate" title="' + sel.selector.replace(/"/g, '&quot;') + '">' + sel.selectorType + '</td>');
        if (savedSelectors) {
            selector.push('<td class="text-truncate" title="'+ sel.selector.replace(/"/g, '&quot;') + '">' +
                savedSelectors.elementSelectors[i].selectorMatches + '</td>');
        }
        else {
            selector.push('<td class="text-truncate" title="' + sel.selector.replace(/"/g, '&quot;') + '">' + sel.selector + '</td>');
        }
        selector.push("</tr>");
        i += 1;
    }
    selector.push('</tbody>');
    selector.push('</table>');
    return selector.join("");
}


/*
 * ---------------------------------------------------------------------------------------
 * UI that lists the repeat choices for the event types. Once, Until, etc.
 * ---------------------------------------------------------------------------------------
 */


/*
 * Handles the creation of the repeat choices for the various event types.
 */
function createRepeatChoices(event) {
    let event_id = event.id;
    let modal = [];
    // REPEAT CHOICES
    if (event.actionName === "click") {
        modal.push(createClickRepeatChoices(event_id));
    }
    else if (event.actionName === "select_all_links") {
        modal.push(createSelectAllLinksRepeatChoices(event_id));
    }
    else if (event.actionName === "scroll") {
        modal.push(createScrollRepeatChoices(event_id));
        attachScrollSelectorMouseOverEvents(event);
    }

    // EXIT CONDITION
    $("#repeat_choices_"+event_id).append(modal.join(""));
    if (event.actionName === "click") {
        attachClickUntilExitConditions(event_id);
    }
    else if (event.actionName === "scroll") {
        let exit_condition = createScrollExitCondition(event_id);
        $("#exit_condition_" + event_id).html(exit_condition);
    }
}

/*
 * Creates repeat choices for Scrolling.
 */
function createScrollRepeatChoices(event_id) {
    let modal = [];
    modal.push('<div class="form-group">');
    modal.push('<label for="scroll_until_' + event_id +'">Scroll</label>');
    modal.push('<select class="form-control form-control-sm" id="scroll_until_' + event_id + '" required>');
    modal.push('<option value="scroll_until_repeated_' +event_id+'" selected>Until</option>');

    modal.push('</select>');
    modal.push('</div>');

    //modal.push('<div id="exit_condition_'+event_id+'"></div>');
    $("#choose_element_" + event_id).attr("disabled", true);
    //let exit_condition = createScrollExitCondition(event_id);
    //$("#exit_condition_" + event_id).html(exit_condition);

    //modal.push(createScrollRepeatChoices(event_id));
    $("#repeat_choices_"+event_id).append(modal.join(""));
    let exit_condition = createScrollExitCondition(event_id);
    $("#exit_condition_" + event_id).html(exit_condition);

    $("#save_"+event_id).attr("disabled", false);
    $("#save_"+event_id).removeClass("d-none");

    return modal.join("");
}

/*
 * Creates repeat choices for "Select all links".
 */
function createSelectAllLinksRepeatChoices(event_id) {
    let modal = [];
    modal.push('<div class="form-group">');
    modal.push('<label for="select_all_links_until_' + event_id +'">Click</label>');
    modal.push('<select class="form-control form-control-sm" id="select_all_links_until_' + event_id + '" required>');
    modal.push('<option value="select_all_links_until_once_' +event_id+'">Once</option>');

    modal.push('</select>');

    modal.push('</div>');
    return modal.join("");
}

/*
 * Creates repeat choices for Clicks.
 */
function createClickRepeatChoices(event_id) {
    let modal = [];
    modal.push('<div class="form-group">');
    modal.push('<label for="click_until_' + event_id +'">Click</label>');

    modal.push('<select class="form-control form-control-sm" id="click_until_' + event_id + '" required>');
    modal.push('<option value="click_until_once_' +event_id+'">Once</option>');

    modal.push('<option value="click_until_repeated_'+event_id+'">Until</option>');

    modal.push('<option value="click_multi_repeated_'+event_id+'">Multi</option>');

    modal.push('</select>');

    modal.push('</div>');
    return modal.join("");
}

/*
 * ---------------------------------------------------------------------------------------
 * Mouse-Over Events
 *
 *
 * Attaches to mouse-over events to highlight the matches of the
 * selector the user has chosen.
 *
 * This method sends a message to a listener in "content-highlighter.js"
 * which actually draws the highlighter over the matches. The extension
 * cannot directly talk to the loaded HTML page.
 * ---------------------------------------------------------------------------------------
 */

/*
 * Enables highlighting the viewport of a scroll window.
 * Used in the exit-condition section of the add-new-event window
 * and only when scrolling is chosen as even-type.
 */
function attachScrollSelectorMouseOverEvents(event) {
    if (!event) {
        return;
    }
    let selectorElement = $("#scroll_exit_condition_"+event.id);

    $(selectorElement).on("mouseover", function() {
        sendMessageToActiveTab({"highlightViewport": true});
    });
    $(selectorElement).on("mouseout", function() {
        sendMessageToActiveTab({"removeViewportHighlight": true});
    });

}

function attachScrollButtonMouseOverEvents(event) {

    let eventElement = $("#scroll_event_"+event.id);

    $(eventElement).on("mouseover", function() {
        sendMessageToActiveTab({"highlightViewport": true});
    });
    $(eventElement).on("mouseout", function() {
        sendMessageToActiveTab({"removeViewportHighlight": true});
    });
    
}

/*
 * Enables highlighting of matched elements for click-until
 * scenarios where the user has selected an element that would
 * match the max number of pages to scroll. This method will
 * highlight these matched elements from the "Exit Condition"
 * section.
 */
function attachExitSelectorMouseOverEvents(event) {
    if (!event || !event.selectors) {
        return;
    }
    let noOfSelectors = event.selectors.length;
    for (let i=0; i<noOfSelectors; i++) {
        let selectorElement = $("#exit_condition_"+event.id+"_"+(i+3));
        $(selectorElement).on("mouseover", function() {
            let selector = event.selectors[i];

            sendMessageToActiveTab({"highlightElements": selector});
        });
        $(selectorElement).on("mouseout", function() {
            let selector = event.selectors[i];

            sendMessageToActiveTab({"removeElementHighlight": selector});
        });

        let selectorElement2 = $("#selector_exit_condition_"+event.id+"_"+(i+3));
        $(selectorElement2).on("mouseover", function() {
            let selector = event.selectors[i];

            sendMessageToActiveTab({"highlightElements": selector});
        });
        $(selectorElement2).on("mouseout", function() {
            let selector = event.selectors[i];

            sendMessageToActiveTab({"removeElementHighlight": selector});
        });


    }
}

function attachHighlightMouseOverToElement(selectorElement, i, event) {
    $(selectorElement).on("mouseover", function() {
        // console.log("mouseover for ");
        // console.log(selectorElement);
        let selector = event.selectors[i];
        // console.log("selector:");
        // console.log(selector);

        if (selectorElement[0].id.includes("event_")) {

            if (selector.selectorPreferred === true) {

                sendMessageToActiveTab({"highlightElements": selector});

            }
        } else {
            sendMessageToActiveTab({"highlightElements": selector});
        }
    });
    $(selectorElement).on("mouseout", function() {
        let selector = event.selectors[i];

        if (selectorElement[0].id.includes("event_")) {

            if (selector.selectorPreferred === true) {
                sendMessageToActiveTab({"removeElementHighlight": selector});
            }

        } else {
            sendMessageToActiveTab({"removeElementHighlight": selector});
        }

    });

}

/*
 * This highlights the matched elements after the user has
 * chosen a selector for click and select all links scenarios.
 */
function attachSelectorMouseOverEvents(event) {

    if (!event || !event.selectors) {
        return;
    }
    let noOfSelectors = event.selectors.length;
    
    for (let i=0; i<noOfSelectors; i++) {

        let selectorElement = $("#selector_info_"+event.id+"_"+i);
        attachHighlightMouseOverToElement(selectorElement, i, event);
        let eventElement = $("#event_"+event.id);
        attachHighlightMouseOverToElement(eventElement, i, event);
        // let scrollEventElement = $("#scroll_event_" + event.id);
        let untilSelectorElement = $('#selector_exit_condition_' + event.id + "_" + i);
        attachHighlightMouseOverToElement(untilSelectorElement, i, event);

        // let endclickSelectorEvent = $('#')
    }

    attachScrollButtonMouseOverEvents(event);
}



/*
 * ---------------------------------------------------------------------------------------
 * Modal Windows for adding new events, reviewing created events, etc.
 * ---------------------------------------------------------------------------------------
 */


/*
 * Opens a read-only viewer that shows the details of an already created
 * event. This is opened when the user clicks on an event that had already
 * been created.
 */
function createModalEventViewer(event) {
    let event_id = event.id;

    let modal = [];
    modal.push('<div class="modal fade" id="action_modal_'+event_id+'" tabindex="-1" role="dialog">');
    modal.push('<div class="modal-dialog" role="document"><div class="modal-content"><div class="modal-header bg-dark">');
    modal.push('<h5 class="modal-title text-white" id="myModalLabel">View Event</h5>');
    modal.push('<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span class="text-white" aria-hidden="true">&times;</span></button>');
    modal.push('</div>');
    // END HEADER

    // modal BODY
    modal.push('<div class="modal-body" style="font-size: 1.3em;">');
    modal.push('<form>');
    let action_name = (event.name) ? event.name : "";
    modal.push('<div class="form-group">');
    modal.push('<span class="text-muted">Name:&nbsp;</span>');
    modal.push('<span>' + action_name + '</span>');
    modal.push('</div>');

    modal.push('<div class="form-group">');
    modal.push('<span class="text-muted">Type:&nbsp;</span>');
    modal.push('<span class="text-capitalize">' + event.actionName + '</span>');
    modal.push('</div>');

    if (event.selectors.length > 0) {
        // modal.push(createSelectorTable(event.selectors, event_id, readonly=true));
        for (let sel of event.selectors) {
            if (sel.selectorPreferred) {
                modal.push('<div class="form-group">');
                modal.push('<span class="text-muted">Selector:&nbsp;</span>');
                modal.push('<span>' + sel.selector + '</span>');
                modal.push('</div>');

                sendMessageToActiveTab({"highlightElements": sel.selector});

                break;
            }
        }
    }

    modal.push('<div class="form-group">');
    modal.push('<span class="text-muted text-capitalize">'+event.actionName+':&nbsp;</span>');
    if (event.repeat.hasOwnProperty("until")) {
        modal.push('<span>Until <br/>' + JSON.stringify(event.repeat.until, null, 2) + '</span>');
    }
    else if (event.repeat.hasOwnProperty("along_with")){
        modal.push('<span>With <br/>' + JSON.stringify(event.repeat.along_with, null, 2) + '</span>');
    }
    else {
        // modal.push('<span>Until <br/>' + JSON.stringify(event.repeat.until, null, 2) + '</span>');
        modal.push('<span>Once</span>');
    }
    modal.push('</div>');



    modal.push('</form>');
    modal.push('</div></div></div></div>');
    return modal.join("");
}


/*
 * Creates the main form in modal mode when the green + button is clicked
 * for adding new events.
 */
function createModalEventForm(event) {
    let event_id = event.id;

    let modal = [];
    modal.push('<div class="modal fade" id="action_modal_'+event_id+'" tabindex="-1" role="dialog">');
    modal.push('<div class="modal-dialog" role="document"><div class="modal-content"><div class="modal-header bg-dark">');
    modal.push('<h5 class="modal-title text-white" id="myModalLabel">Create New Event</h5>');
    modal.push('<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span class="text-white" aria-hidden="true">&times;</span></button>');
    modal.push('</div>');
    // END HEADER

    // modal BODY
    modal.push('<div class="modal-body" style="font-size: 1.3em;">');
    modal.push('<form>');
    modal.push('<div class="form-group">');

    // NAME
    modal.push('<label for="action_name_' + event_id +'">Name</label>');
    let action_name = (event.name) ? event.name : "";
    modal.push('<input type="text" class="form-control form-control-sm" id="action_name_' + event_id + '" placeholder="Enter optional name for this action" value="' + action_name + '" />');
    modal.push('</div>');

    // EVENT TYPE
    modal.push(createEventTypeChoices(event_id, event.actionName));

    // CHOOSE ELEMENT BUTTON
    modal.push('<div class="btn-toolbar justify-content-center">');
    if (event.actionName === "click") {
        modal.push('<button type="button" class="btn btn-info" id="choose_element_' + event_id + '">Choose Element to Click</button>');
    }

    modal.push('</div>');
    modal.push('<br/>');

    modal.push('<div id="action_selector_'+event_id+'"></div>');
    modal.push('<div id="repeat_choices_'+event_id+'"></div>');
    modal.push('<div id="exit_condition_'+event_id+'"></div>');
    modal.push('</form>');
    modal.push('<div id="event_btns_'+event_id+'">');
    modal.push('<div class="btn-toolbar justify-content-center">');
    modal.push('<div class="btn-group" role="group">');
    modal.push('<button type="button" class="btn btn-success d-none" id="save_' + event_id + '" data-dismiss="modal" disabled>Save</button>');
    modal.push("</div>");
    modal.push("</div>");
    modal.push('</div></div></div></div>');
    return modal.join("");
}

/*
 * Creates the modal window when the "download" button is clicked.
 * Shows a form to enter a name for the trace and to fill the URI
 * pattern for the trace.
 */
function createModalDownloadViewer(resource_url) {

    let modal = [];
    modal.push('<div class="modal fade" id="download_modal" tabindex="-1" role="dialog">');
    modal.push('<div class="modal-dialog" role="document"><div class="modal-content"><div class="modal-header bg-dark">');
    modal.push('<h5 class="modal-title text-white" id="myModalLabel">Download Trace</h5>');
    modal.push('<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span class="text-white" aria-hidden="true">&times;</span></button>');
    modal.push('</div>');
    // END HEADER

    // modal BODY
    modal.push('<div class="modal-body" style="font-size: 1.3em;">');
    modal.push('<form>');

    // NAME
    modal.push('<div class="form-group">');
    modal.push('<label for="trace_name">Trace Name</label>');
    modal.push('<input type="text" class="form-control form-control-sm" id="trace_name" placeholder="Enter a name for this trace" value="" />');
    modal.push('</div>');

    // URI Pattern
    modal.push('<div class="form-group">');
    modal.push('<label for="trace_name">Trace URI Pattern</label>');
    modal.push('<input type="text" class="form-control form-control-sm" id="trace_uri_pattern" placeholder="Enter the URI pattern to apply for this trace" value="'+resource_url+'" />');
    modal.push('</div>');
    modal.push('</form>');

    modal.push('<div class="btn-toolbar justify-content-center">');
    modal.push('<div class="btn-group" role="group">');
    modal.push('<button type="button" class="btn btn-primary" id="download_as_json" data-dismiss="modal">Download</button>');
    modal.push("</div>");
    modal.push("</div>");

    modal.push('</div></div></div></div>');
    return modal.join("");
}


/*
 * Handles the updating of the UI when an event is created or deleted or
 * any other changes that requires the UI to be refreshed.
 */
function updateEventModalUI(event, chosenSelectors) {
    let eventId = event.id;
    let selectorEle = $("#action_selector_" + eventId);
    let selectorUI = createSelectorTable(event.selectors, eventId,
        readonly=null, savedSelectors=chosenSelectors);

    selectorEle.html(selectorUI);
    attachSelectorMouseOverEvents(event);

    createRepeatChoices(event);

    $("#choose_element_"+eventId).attr("disabled", true);
    $("#action_type_"+eventId).attr("disabled", true);
    //$("#click_until_"+eventId).attr("disabled", true);
    //$("#select_all_links_until_"+eventId).attr("disabled", true);
    //$("#exit_condition_"+eventId+" :radio:not(:checked)").attr("disabled", true);
    $("#save_"+eventId).attr("disabled", false);
    $("#save_"+eventId).removeClass("d-none");
}


/*
 * ---------------------------------------------------------------------------------------
 * The Main UI that we see when opening the extension
 * ---------------------------------------------------------------------------------------
 */

/*
 * Adds the relevant buttons with their relevant state for an event.
 *
 * This adds the main button that shows the event name, the +/add and delete
 * buttons as well. It disables the delete button for starting resource.
 */
function createEventButtons(event, width_class, insertCopiedTrace, outLink) {

    let startingResource = false;
    if (event.actionName === "load") {
        startingResource = true;
    }
    let event_ui = [];
    event_ui.push('<div class="btn-group justify-content-end '+width_class+'" role="group">');
    event_ui.push('<button type="button" ');

    if (event.actionName == "scroll") {
        event_ui.push('id="scroll_event_' + event.id + '"');
    } else {
        event_ui.push('id="event_' + event.id + '"');
    }
    event_ui.push('class="btn btn-outline-primary btn-block ');
    event_ui.push(width_class + '"');
    event_ui.push('title="Click to view more details on this Event" ');
    event_ui.push('rel="tooltip" data-toggle="modal"');
    event_ui.push('data-target="#action_modal_' + event.id + '"');
    event_ui.push('>');
    if (event.repeat.hasOwnProperty("until")) {
        event_ui.push('<span class="adjust-line-height fas fa-retweet float-right"></span>');
    }
    if (outLink) {
        event_ui.push('<span class="adjust-line-height fas fa-external-link-alt float-right"></span>');

    }
    event_ui.push(event.name);
    event_ui.push('</button>');
    if (!insertCopiedTrace) {
        event_ui.push('<button type="button" class="btn btn-default btn-success tracer-bg" id="create_event_for_'+event.id+'" title="Create Event"><span class="fas fa-plus-square"></span></button>');
    }
    else {
        event_ui.push('<button type="button" class="btn btn-default btn-warning tracer-bg" id="insert_event_for_'+event.id+'" title="Insert Copied Event"><span class="fas fa-clone"></span></button>');
    }
    if (event.eventOrder === 1) {
        event_ui.push('<button type="button" class="btn btn-default btn-danger tracer-bg" id="delete_event_'+event.id+'" title="Delete Event" disabled><span class="fas fa-trash-alt"></span></button>');
    }
    else {
        event_ui.push('<button type="button" class="btn btn-default btn-danger tracer-bg" id="delete_event_'+event.id+'" title="Delete Event"><span class="fas fa-trash-alt"></span></button>');
    }

    event_ui.push('</div>');
    return event_ui.join("");
}

/*
 * The main function that orchestrates the UI creation for a trace.
 *
 * This iterates over a trace, determines the display width of an event,
 * creates buttons, and attaches click events etc. This also handles the
 * copied partial trace from other pages.
 */
function createEventUI(actions, resource_url, copiedTrace) {
    // DFS
    let stack = [];
    let eventIds = Object.keys(actions);

    let insertCopiedTrace = false;
    if (copiedTrace) {
        let copiedEventIds = Object.keys(copiedTrace._actions);
        let copiedResourceUrl = copiedTrace._actions[copiedEventIds[0]].locationUrl;
        if (copiedResourceUrl !== resource_url) {
            insertCopiedTrace = true;
        }
    }

    for (let eventId of eventIds) {
        stack.push(actions[eventId]);
    }

    let parentIds = {};
    parentIds[stack[0].id] = 0;
    $("#event_ui").empty();

    while (stack.length > 0) {
        let ui = [];
        let currEvent = stack.pop();
        let outLink = false;

        if (resource_url && currEvent.locationUrl && resource_url !== currEvent.locationUrl) {
            outLink = true;
        }
        let widthClass = getWidthForEvent(currEvent, parentIds[currEvent.id]);
        ui.push(createEventButtons(currEvent, widthClass, insertCopiedTrace, outLink));
        ui.push(createModalEventViewer(currEvent));
        $("#event_ui").append(ui.join(""));
        attachCreateDeleteButtonEvents(currEvent);
        if (insertCopiedTrace) {
            attachInsertButtonEvent(currEvent, copiedTrace);
        }
        attachSelectorMouseOverEvents(currEvent);

        let sortedChildren = getActionsByEventOrder(currEvent.children);
        for (let event of sortedChildren) {
            stack.push(event);
            parentIds[event.id] = parentIds[event.parentId] + 1;
        }
    }
}


/*
 * ---------------------------------------------------------------------------------------
 * Mouse Click Events
 * ---------------------------------------------------------------------------------------
 */


/*
 * Handles the insertion of a partial trace from another URL
 * to the trace in question.
 *
 * When the paste button is clicked in the UI, this handler will
 * find the appropriate event id of this trace in the Trace object
 * and insert the copied trace as it's child.
 */
function attachInsertButtonEvent(event, copiedTrace) {
    $("#insert_event_for_"+event.id).on("click", function() {
        let stack = [];
        let currentEvent = trace.getTracerEvent(event.id);
        let newChildren = currentEvent.children;
        let copiedStartingResourceId = Object.keys(copiedTrace._actions)[0];
        let copiedStartingResource = copiedTrace._actions[copiedStartingResourceId];
        let copiedChildEventIds = Object.keys(copiedStartingResource.children);
        let parentIds = {};
        for (let eventId of copiedChildEventIds) {
            stack.push(copiedStartingResource.children[eventId]);
        }
        while (stack.length > 0) {
            let copiedEvent = stack.pop();
            let newParentId = null;
            if (parentIds.hasOwnProperty(copiedEvent.parentId)) {
                newParentId = parentIds[copiedEvent.parentId];
            }
            else {
                newParentId = event.id;
            }
            let newEvent = new TracerEvent(
                eventName=copiedEvent.name,
                actionName=copiedEvent.actionName,
                resourceUrl=(!copiedEvent.locationUrl) ? copiedStartingResource.locationUrl : copiedEvent.locationUrl,
                parentId=newParentId
            );
            newEvent.selectors = copiedEvent.selectors;
            newEvent.repeat = copiedEvent.repeat;

            parentIds[copiedEvent.id] = newEvent.id;
            trace.addTracerEvent(newEvent);
            for (let eventId of Object.keys(copiedEvent.children)) {
                stack.push(copiedEvent.children[eventId]);
            }
        }
        let newEvent = {};
        getStoredEvents().then( (items) => {
            let resource_url = items[1];
            newEvent[resource_url] = trace.toJSON();
            newEvent["copiedTrace"] = null;
            chrome.storage.local.set(newEvent);
            createEventUI(trace.actions, resource_url, null);
        });
    });
}

/*
 * Handles the opening of the appropriate modal window when
 * the + button is clicked to add a new event and also handles the
 * deletion of an event and it's children when the trash button is clicked.
 */
function attachCreateDeleteButtonEvents(event) {
    $("#create_event_for_" + event.id).on("click", function() {
        getStoredEvents().then( (items) => {
            // let events = items[0];
            //let eventCount = Object.keys(items.events.actions).length;
            let newEventData = createNewEventMetadata(event.id);
            let newEventModal = createModalEventForm(newEventData);
            $("#event_ui").append(newEventModal);
            $("#action_modal_"+newEventData.id).modal("show");
            attachModalCloseEvents(newEventData.id);
            attachActionTypeSelectMenuEvents(newEventData);
            attachChooseElementEventListener(newEventData.id);
            attachSaveEventListener(newEventData.id);
            attachEndClickEventListener(newEventData.id);
        });
    });

    $("#delete_event_" + event.id).on("click", function() {
        chrome.tabs.query({ active: true }, function(tabs) {
            
            for (i = 0; i < tabs.length; i++) {
                if (tabs[i].url != chrome.runtime.getURL("popup.html")) {
                    trace.deleteEvent(event.id);
                    let resource_url = tabs[i].url;
                    let newEvent = {};
                    newEvent[resource_url] = trace.toJSON();
                    chrome.storage.local.set(newEvent);
                    createEventUI(trace.actions, resource_url, null);
                }
            }
        });
    });
}

/*
 * Detaches any selector highlighters that may be active
 * when an "add new event" modal is closed.
 */
function attachModalCloseEvents(eventId) {
    $("#action_modal_"+eventId).on("hidden.bs.modal", function() {
        sendMessageToActiveTab({detachRecorder: true});
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            createEventUI(trace.actions, tabs[0].url, null);
        });
    });
}

/*
 * SAVE button.
 *
 * Handles saving all the event details when creating a new event.
 * Once all the details have been collected, this new event is
 * added to the Tracer object, and stored in the extension's db.
 */
function attachSaveEventListener(eventId) {
    $("#save_" + eventId).on("click", function() {

        console.log();
        console.log("#####");
        console.log("Save button clicked...");
        console.log(tempNewEvents);
        console.log(trace);
        console.log("#####");
        console.log();

        tempNewEvents[eventId]["actionName"] = $("#action_type_" + eventId + " :selected").text().toLowerCase();
        let currentEvent = tempNewEvents[eventId];

        let eventName = "";

        if (currentEvent.default_name_set === true) {
            eventName = $("#action_name_"+eventId).val() + " (" + currentEvent.actionName + ")";
        } else {
            eventName = $("#action_name_"+eventId).val();
        }
        
        currentEvent.name = eventName;
        let selectorPref = $("input[name=selector_info_preference_"+eventId+"]:checked").val();
        let prefSelector = null;
        for (let i=0; i<currentEvent.selectors.length; i++) {
            if (parseInt(selectorPref) === i) {
                currentEvent.selectors[i].selectorPreferred = true;
                prefSelector = currentEvent.selectors[i];
            }
            else {
                currentEvent.selectors[i].selectorPreferred = false;
            }
        }
        let selected_action = null;
        if (currentEvent.actionName === "scroll") {
            selected_action = $("#scroll_until_" + eventId + " :selected").text();
        }
        else {
            selected_action = $("#click_until_" + eventId + " :selected").text();
        }
        if (selected_action === "Until") {
            let exit_cond = $("input[name=exit_condition_"+eventId+"]:checked").val();
            let until = {};
            // console.log(exit_cond);
            if (exit_cond === "element-with-selected-number") {
                let sel_exit_cond = $("input[name=selector_exit_condition_" + eventId + "]:checked").val();
                
                // console.log("sel_exit_cond = " + sel_exit_cond);

                if (sel_exit_cond === "3") {
                    until.selectorType = "CSSSelector";
                    until.selectorCondition = "value_matches";
                    let selId = $("input[name=selector_exit_condition_"+eventId+"]:checked").attr("label");
                    until.selectorValue = selId;
                }
                else if (sel_exit_cond === "4") {
                    until.selectorType = "XPath";
                    until.selectorCondition = "value_matches";
                    let selId = $("input[name=selector_exit_condition_"+eventId+"]:checked").attr("label");
                    until.selectorValue = selId;
                }
                else if (sel_exit_cond === "5") {
                    until.selectorType = "XPath";
                    until.selectorCondition = "value_matches";
                    let selId = $("input[name=selector_exit_condition_"+eventId+"]:checked").attr("label");
                    until.selectorValue = selId;
                }
    
            }
            else if (exit_cond === "user-supplied-number") {
                // this should correspond to User-Supplied Number
                until.SelectorType = "new_resource_count";
                until.selectorCondition = "equals";
                until.selectorValue = parseInt($("#user_supplied_number_value" + eventId).val(), 10);
            }
            else if (exit_cond === "no-more-pages") {
                // this should correspond to "There Are No More Pages"
                until.selectorType = "selectorPreferred";
                until.selectorCondition = "default";
            }
            else if (currentEvent.actionName === "scroll") {
                until.selectorType = "Scroll";
                until.selectorCondition = "scrollCount";
                until.selectorValue = $("#scroll_until_num_" + eventId).val();
                until.selectorValue = until.selectorValue !== "" ? until.selectorValue : "all";
            }
            currentEvent.repeat = {};
            currentEvent.repeat.until = until;
        }
        else if (selected_action == "Multi") {
            let exit_cond = $("input[name=multi_condition_"+eventId+"]:checked").val();
            let along_with = {};
            along_with.exit_cond = exit_cond;

            if (exit_cond === "element-to-be-clicked") {

                let sel_exit_cond = $("input[name=selector_exit_condition_" + eventId + "]:checked").val();

                if (sel_exit_cond === "3") {
                    along_with.selectorType = "CSSSelector";
                    along_with.selectorCondition = "closebutton";
                    let selId = $("input[name=selector_exit_condition_"+eventId+"]:checked").attr("label");
                    along_with.selectorValue = selId;
                }
                else if (sel_exit_cond === "4") {
                    along_with.selectorType = "XPath";
                    along_with.selectorCondition = "closebutton";
                    let selId = $("input[name=selector_exit_condition_"+eventId+"]:checked").attr("label");
                    untalong_withil.selectorValue = selId;
                }
                else if (sel_exit_cond === "5") {
                    along_with.selectorType = "XPath";
                    along_with.selectorCondition = "closebutton";
                    let selId = $("input[name=selector_exit_condition_"+eventId+"]:checked").attr("label");
                    along_with.selectorValue = selId;
                }

            }
            else {
                along_with.selectorType = "built-in";
                along_with.selectorCondition = "browserback";
            }
            currentEvent.repeat = {};
            currentEvent.repeat.along_with = along_with;
        }
        else {
            currentEvent.repeat = {};
        }

        trace.addTracerEvent(currentEvent);
        let event = {};
        getStoredEvents().then( (items) => {
            let resource_url = items[1];
            event[resource_url] = trace.toJSON();
            chrome.storage.local.set(event);
        });
    });
}


/*
 * ---------------------------------------------------------------------------------------
 * Menu Change Listeners
 * ---------------------------------------------------------------------------------------
 */

/*
 * An event listener that listens to when the user chooses the
 * option in the exit condition to select the element that would
 * match the maxinum number of pages to crawl.
 *
 * When this option is chosen by the user, this handler will create
 * a button to let the user choose the element.
 */
function attachChangeExitConditionListener(eventId) {
    $("input[name=exit_condition_"+eventId+"]").change( function() {
        // console.log("exit_condition_" + eventId + " was clicked with a value of " + $(this).val());
        if ($(this).val() === "element-with-selected-number") {

            // $("#choose_user_supplied_pages_" + eventId).remove();

            // console.log("maximum number element area: " + $("#maximum_number_element_area").length);
            // console.log($("#maximum_number_element_area"));
            // console.log($("#maximum_number_element_area").text());

            // if ($("#maximum_number_element_area").length == 0) {
            if ($("#maximum_number_element_area").text() === "") {
                let button = '<button type="button" class="btn btn-xs btn-info" style="font-size: small; margin: 10px 10px;" ' +
                    'id="choose_total_pages_' + eventId + '">' +
                    'Choose element</button>';

                // $("#exit_condition_" + eventId).append(button);
                $("#maximum_number_element_area").html(button);
                attachChooseTotalPagesEventListener(eventId);
            }

        } else {
            $("#choose_total_pages_" + eventId).remove();
            $("#maximum_number_element_area").empty();
            // $("#choose_user_supplied_pages_" + eventId).remove();
        }
    });
}

/*
 * An event listener that listens to when the user chooses the
 * option in the exit condition to select the element that would
 * match the maxinum number of pages to crawl.
 *
 * When this option is chosen by the user, this handler will create
 * a button to let the user choose the element.
 */
function attachChangeMultiConditionListener(eventId) {
    $("input[name=multi_condition_"+eventId+"]").change( function() {

        if ($(this).val() === "element-to-be-clicked") {

            if ($("#end_element_to_be_clicked").text() === "") {
                let button = '<button type="button" class="btn btn-xs btn-info" style="font-size: small; margin: 10px 10px;" ' + 'id="end_element_' + eventId + '">' +
                'Choose element</button>';

                $("#end_element_to_be_clicked").html(button);
                attachEndClickEventListener(eventId);
            }

        } else {
            $("#choose_total_pages_" + eventId).remove();
            $("#end_element_to_be_clicked").empty();
        }
    });
}

/*
 * Handles changes to the action type select menu and opens/closes
 * the appropriate exit conditions or other sections depending
 * on the menu chosen.
 */
function attachActionTypeSelectMenuEvents(event) {
    let eventId = event.id;
    $("#action_type_" + eventId).on("change", function() {
        let selected_action = $("#action_type_" + eventId + " :selected").text();

        if (selected_action === "Click") {
            $("#choose_element_"+eventId).show();
            $("#choose_element_"+eventId).text("Choose Element to Click");
        }
        else if (selected_action === "Click All Links in an Area" ) {
            $("#choose_element_"+eventId).show();
            $("#choose_element_"+eventId).text("Choose Area For Elements to Click");
        }
        else if (selected_action === "Scroll" ) {
            $("#choose_element_"+eventId).hide();
        }
        else if (selected_action === "Hover" ) {
            $("#choose_element_"+eventId).show();
            $("#choose_element_"+eventId).text("Choose Element For Hover");
        }
        // else if (selected_action === "Click And Back") {
        //     $("#choose_element_"+eventId).show();
        //     $("#choose_element_"+eventId).text("Choose Element to Click");
        // }


        if (selected_action === "Click"
            && $("#choose_element_"+eventId).is(":disabled"))  {

            $("#exit_condition_" + eventId).empty();
            let repeat_choices = createClickRepeatChoices(eventId);
            $("#repeat_choices_" + eventId).html(repeat_choices);
            attachClickUntilExitConditions(eventId);
            
        }
        else if (selected_action === "Click All Links in an Area"
            && $("#choose_element_"+eventId).is(":disabled")) {

            let repeat_choices = createSelectAllLinksRepeatChoices(eventId);
            $("#exit_condition_" + eventId).empty();
            $("#repeat_choices_" + eventId).html(repeat_choices);
        }
        else if (selected_action === "Scroll") {
            let repeat_choices = createScrollRepeatChoices(eventId);
            $("#repeat_choices_" + eventId).html(repeat_choices);
            attachScrollSelectorMouseOverEvents(event);
        }
    });
}

/*
 * Handles the changes to the click until options and opens/closes
 * UI sections appropriately.
 */
function attachClickUntilExitConditions(eventId) {
    $("#click_until_" + eventId).on("change", function() {
        let selected_action = $("#click_until_" + eventId + " :selected").text();
        if (selected_action === "Until") {
            let exit_condition = createClickExitCondition(eventId);
            $("#exit_condition_" + eventId).html(exit_condition);
            attachChangeExitConditionListener(eventId);
            attachChooseTotalPagesEventListener(eventId);
        }
        else if (selected_action === "Multi") {
            console.log("Multi was clicked!");
            let exit_condition = createClickMultiCondition(eventId);
            $("#exit_condition_" + eventId).html(exit_condition);
            attachChangeMultiConditionListener(eventId);
            attachEndClickEventListener(eventId);
        }
        else if (selected_action === "Once") {
            $("#exit_condition_" + eventId).empty();
        }
    });
}


/*
 * Activates click recording for the user when the user
 * clicks on the button to select an element that matches the
 * max number of pages to crawl.
 *
 * The extension cannot talk to the loaded HTML page directly,
 * hence this method will send a message to "recorder.js" which
 * will listen to this message and activate the appropriate
 * listeners to record the clicks.
 */
function attachChooseTotalPagesEventListener(eventId) {

    // console.log("attaching event listener for choose_total_pages_" + eventId);

    $("#choose_total_pages_"+eventId).on("click", function() {
        // console.log("choose_total_pages_" + eventId + " was clicked");
        $(this).attr("disabled", true);
        let message = {};
        message["attachRecorder"] = [["click", "mouseover"], eventId, "total_pages"];
        sendMessageToActiveTab(message);
    });
}

/*
 * Activates click recording for the user when the user
 * clicks on the button to select an element that matches the
 * end click as part of the Multi type of Click.
 *
 * The extension cannot talk to the loaded HTML page directly,
 * hence this method will send a message to "recorder.js" which
 * will listen to this message and activate the appropriate
 * listeners to record the clicks.
 */
function attachEndClickEventListener(eventId) {

    // console.log("attaching event listener for choose_total_pages_" + eventId);

    $("#end_element_"+eventId).on("click", function() {
        console.log("end_element was clicked!!!");
        $(this).attr("disabled", true);
        let message = {};
        message["attachRecorder"] = [["click", "mouseover"], eventId, "end_element"];
        sendMessageToActiveTab(message);
    });
}

/*
 * Activates click recording for the user when the user
 * clicks on the button to select an element to record the
 * selector for an event.
 *
 * The extension cannot talk to the loaded HTML page directly,
 * hence this method will send a message to "recorder.js" which
 * will listen to this message and activate the appropriate
 * listeners to record the clicks.
 */
function attachChooseElementEventListener(eventId) {
    $("#choose_element_"+eventId).on("click", function() {
        
        $(this).attr("disabled", true);
        let event_type = $("#action_type_" + eventId + " :selected").text();
        let message = {};
        if (event_type === "Click") {
            message["attachRecorder"] = [["click", "mouseover"], eventId, "click"];
        }
        else if (event_type === "Click All Links in an Area") {
            message["attachRecorder"] = [["click", "mouseover"], eventId, "select_all_links"];
        }
        else if (event_type === "Hover") {
            message["attachRecorder"] = [["click", "mouseover"], eventId, "hover"];
        }
        // else if (event_type === "Click and Back") {
        //     message["attachRecorder"] = [["click", "mouseover"], eventId, "clickandback"];
        // }
        // else if (event_type === "Multi-Click") {
        //     message["attachRecorder"] = [["click", "mouseover"], eventId, "multiclick"];
        // }
        
        sendMessageToActiveTab(message);
    });
}

function sendMessageToActiveTab(message) {

    chrome.tabs.query({ active: true }, function(tabs) {

        for (i = 0; i < tabs.length; i++) {
            // console.log(tabs);
            if (tabs[i].url != chrome.runtime.getURL("popup.html")) {
                // console.log();
                // console.log("#####");
                // console.log("sending message: [[ ");
                // console.log(message);
                // console.log(tabs[i]);
                // console.log("]] ...");
                // console.log("#####");
                // console.log();
                chrome.tabs.sendMessage(tabs[i].id, message);
                break;
            }
        }

    });

}

/*
 * ---------------------------------------------------------------------------------------
 * Main Extension Init
 * ---------------------------------------------------------------------------------------
 */

/*
 * Initializes the extension with the required data for a page everytime a
 * tab is opened or becomes active.
 *
 * Reads the database to see if a trace exists for a URL and starts with
 * a default if not. Checks if there are partial traces copied from other
 * pages and activates appropriate UI.
 */
function popupInit(onTabActivated) {
    // Checking storage first to see if a trace already exists for the
    // loaded URL.
    getStoredEvents().then( (items) => {
        let resource_url = items[1];
        let events = items[0];

        console.log("resource_url: " + resource_url);
        // console.log("events:");
        // console.log(events);

        // If a copied trace exists in memory, then it exists
        // as a string. It is converted to a Trace object before it can be
        // appended into any existing trace.
        let copiedTraceJson = items[2];
        let copiedTrace = Trace.fromJSON(copiedTraceJson);

        // If an existing trace is found for a url, that is loaded and converted
        // into a Trace object as well.
        trace = new Trace();
        if (events !== "") {
            trace = Trace.fromJSON(events);
        }

        // If no existing trace is found, then the default trace is created
        // with the URL  as the starting resource.
        if (!trace || Object.keys(trace._actions).length === 0) {
            trace = createStartingResourceTrace(resource_url);
        }

        // Here the UI for the copied trace is initialized. The copied trace
        // activates the yellow paste icons on all existing events so that it
        // can be appended as a child of that event.
        let copiedResourceUrl = null;
        if (copiedTrace) {
            let copiedStartingResourceId = Object.keys(copiedTrace._actions)[0];
            copiedResourceUrl = copiedTrace._actions[copiedStartingResourceId].locationUrl;
        }
        if (copiedResourceUrl !== resource_url) {
            $("#copy_trace").text("Copy Trace");
            $("#copy_trace").removeClass("btn-danger");
            $("#copy_trace").addClass("btn-success");
            createEventUI(trace.actions, resource_url, copiedTrace);
        }
        else if (copiedResourceUrl === resource_url) {
            createEventUI(trace.actions, resource_url, null);
            $("#copy_trace").text("Clear Copied Trace");
            $("#copy_trace").addClass("btn-danger");
            $("#copy_trace").removeClass("btn-success");
        }

        // Any orphaned modals are removed when the extension is opened.
        // Modals sometimes become orphaned when a user refreshes a page
        // without closing all the opened modals or when there is a bug
        // in the extension.
        $(".modal-backdrop").remove();
        $("#url-traced").empty();
        $("#url-traced").text(resource_url);

        // When a new tab gets focus, but there is no copied trace in
        // memory, there is nothing else to do.
        if (onTabActivated && !copiedTraceJson) {
            return;
        }

        // If we are still working in the current tab, then activate the download
        // button and append it's event listener.
        // TODO: Make this a separate function.
        if (!onTabActivated) {

            let downloadModal = createModalDownloadViewer(resource_url);
            $("#download_modal_container").append(downloadModal);

            $("#download_trace").on("click", function() {
                $("#download_modal").modal("show");
            });
            $("#download_as_json").on("click", function() {

                //console.log(trace);
                trace.traceName = $("#trace_name").val();
                trace.uriPattern = $("#trace_uri_pattern").val();

                trace.uriRegex = createRegExpForPattern(trace.uriPattern);

                let jsonTrace = trace.toJSON();

                // console.log(jsonTrace);

                let blob = new Blob([jsonTrace], {type: "application/json"});
                let res = new URL(resource_url);

                let downloading = chrome.downloads.download({
                    filename: res.hostname + ".json",
                    url: window.URL.createObjectURL(blob),
                    saveAs: true,
                    conflictAction: 'overwrite'
                });
            });
        }
    });

    // If we are still working on the current tab, then activate the copy trace
    // button and the start over button, and it's corresponding event listeners.
    // TODO: Make this a separate function.
    if (!onTabActivated) {
        $("#copy_trace").on("click", function() {
            chrome.storage.local.get(null, function(items) {
                

                if (items["copiedTrace"] && $("#copy_trace").hasClass("btn-danger")) {
                    let eve = {};
                    eve["copiedTrace"] = null;
                    chrome.storage.local.set(eve);

                    $("#copy_trace").text("Copy Trace");
                    $("#copy_trace").removeClass("btn-danger");
                    $("#copy_trace").addClass("btn-success");
                }
                else {
                    items["copiedTrace"] = trace.toJSON();
                    chrome.storage.local.set(items);

                    $("#copy_trace").text("Clear Copied Trace");
                    $("#copy_trace").addClass("btn-danger");
                    $("#copy_trace").removeClass("btn-success");

                    $("#alert_placeholder").html("The events in this trace were copied. You can now go to any existing trace and insert these events as part of that trace.");
                    $("#alert_placeholder").removeClass("d-none");
                    setTimeout(function() {
                        $("#alert_placeholder").alert("close");
                    }, 10000);
                }
            });
        });

        $("#start_over").on("click", function() {
            
            chrome.tabs.query({ active: true }, function(tabs) {

                for (i = 0; i < tabs.length; i++) {

                    if (tabs[i].url != chrome.runtime.getURL("popup.html")) {
                        let resource_url = tabs[i].url;
                        let event = {};
                        //let resource_url = items[1];
                        event[resource_url] = "";
                        chrome.storage.local.set(event);
                        trace = new Trace();
                        trace = createStartingResourceTrace(resource_url);
                        createEventUI(trace.actions, resource_url);
                        $("#url-traced").empty();
                        $("#url-traced").text(resource_url);
                        break;
                    }
                }
            });
        });
    }
}


/*
 * ---------------------------------------------------------------------------------------
 * Browser Event Listeners
 * ---------------------------------------------------------------------------------------
 */

/*
 * Initialize the extension every time a new browser window gets
 * focus.
 */
/*
chrome.windows.onFocusChanged.addListener( () => {
    console.log("focus changed...");
    popupInit(true);
});
*/

/*
 * Initialize the extension every time a tab is activated.
 */


// chrome.tabs.onActivated.addListener( (tabInfo) => {
//     // Note
//     // console.log("tab has been activated...");
//     // console.log(tabInfo);
//     popupInit(true);
// });

// chrome.tabs.onUpdated.addListener( (tabInfo) => {
//     // Note
//     // console.log("tab has been updated...");
//     // console.log(tabInfo);
//     popupInit(true);
// });


/*
 * Listen and Update UI every time changes are made to the browser/extension
 * storage.
 *
 * The recorder component saves the details of the recorded click in this storage
 * and this extension ui listens to this change and updates the UI accordingly.
 *
 * The recorder component cannot talk directly to the extension UI and hence this
 * message passing is necessary.
 */
chrome.storage.onChanged.addListener((changes) => {

    console.log("######");
    console.log("chrome.storage.onChanged.addListener");
    console.log("changes: ");
    console.log(changes);
    console.log("######");

    if (changes.hasOwnProperty("totalPages") && changes.totalPages.newValue.chosenSelectors) {
        let val = changes.totalPages.newValue;
        chrome.storage.local.set({"totalPages": {}});
        updateExitCondition(val.chosenSelectors);
    }
    else if (changes.hasOwnProperty("endElement") && changes.endElement.newValue.chosenSelectors) {
        
        let val = changes.endElement.newValue;
        chrome.storage.local.set({"end_element": {}});
        updateExitCondition(val.chosenSelectors);
    }
    else if (changes.hasOwnProperty("clickedSelector") && changes.clickedSelector.newValue.chosenSelectors) {
        let val = changes.clickedSelector.newValue;
        let eventId = val.chosenSelectors.eventId;
        if (tempNewEvents[eventId] && tempNewEvents[eventId].selectors.length > 0) {
            return;
        }
        let newEvent = updateEvent(val.chosenSelectors, val.frameIndex);
        newEvent.actionName = val.eventType;

        updateEventModalUI(newEvent, val.chosenSelectors);

        chrome.storage.local.set({"clickedSelector": {}});
    }
    else {
        console.log("Unknown changes type. What do I do with this?");
    }
    sendMessageToActiveTab({detachRecorder: true});
});



/*
 * ---------------------------------------------------------------------------------------
 * Start/Initialization
 * ---------------------------------------------------------------------------------------
 */

// initializing the storage, trace objects, etc.
var getStoredEvents = getItemsFromStorage;

/*
 * Initializing a global counter that counts the events created for a trace.
 * The starting resource is the first/default event and hence will be incremented from
 * 0 to 1 when the extension is initialized. Other events start from 2.
 */
TracerEvent.eventCount = 0;

/*
 * Initializing a temp events storage that holds an event temporarily between when
 * the user clicks on add new event button and until the
 * save button is clicked by the user.
 */
let tempNewEvents = {};

/*
 * Initializing the new trace.
 */
let trace = new Trace();


/*
 * The main function that starts the extension logic.
 */
( function() {
    // console.log("I have started!!!!");
    // console.log(testVariableOfDoom);
    popupInit();
})();

