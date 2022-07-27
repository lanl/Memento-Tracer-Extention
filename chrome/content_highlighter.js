/* jshint esversion:6 */
/* jshint strict: false */


function getElements(selector) {

	let matchedElements = [];
	if (selector.selectorType == "CSSSelector") {
		matchedElements = document.querySelectorAll(selector.selector); 

	}
	else if (selector.selectorType == "XPath") {
		let res;
		try {
			res = document.evaluate(selector.selector,
				document,
				null,
				XPathResult.ANY_TYPE,
				null);
		}
		catch (e) {
			return matchedElements;
		}
		let ele = res.iterateNext();
		while (ele) {
			matchedElements.push(ele);
			ele = res.iterateNext();
		}
	}
	return matchedElements;
}

function createViewportElement() {
	//if ($("#scroll_viewport_")) {
	//	return;
	//}
	let viewportHeight = 1024;
	let viewportWidth = document.body.offsetWidth;
	let vp = document.createElement("div");
	vp.setAttribute("id", "scroll_viewport_");
	vp.setAttribute("class", "multi-highlighter");
	vp.style.width = viewportWidth + "px";
	vp.style.height = viewportHeight + "px";
	vp.style.top = "0px";
	vp.style.left = "0px";
	vp.style.zIndex = "1000000";
	//vp.style.background = "black";
	vp.style.position = "absolute";
	document.body.appendChild(vp);
	return document.getElementById("scroll_viewport_");
}

function createHighlighter(cls=null) {
	let highlighter = document.createElement("div");
	if (cls) {
		highlighter.setAttribute("class", cls);
	}
	else {
		highlighter.setAttribute("class", "highlighter");
	}
//lb
	highlighter.style.cssText = 'position: absolute; background-color: #17a2b8; opacity: 0.5;  z-index:100000; pointer-events:none; display:none;';
	return highlighter;
}

function showHighlighterForElement(element) {
	let highlighter = createHighlighter("multi-highlighter");
	document.body.appendChild(highlighter);

	let tgt = $(element);
	let offset = tgt.offset();
	let width = tgt.outerWidth();
	let height = tgt.outerHeight();

	$(highlighter).css({
		top: offset.top,
		left: offset.left,
		width: width,
		height: height
		
	}).show();
}

function hideAllHighlighters() {
	$(".multi-highlighter").remove();
}


chrome.runtime.onMessage.addListener( function(msg, sender) {

	console.log("attaching recorder with msg:");
	console.log(msg);

	// if (msg.attachRecorder) {
	// 	console.log('############');
	// 	console.log("attach recorder: ");
	// 	console.log(msg.attachRecorder);	
	// 	console.log('############');
	// }


	console.log("sender was:");
	console.log(sender);

	if (msg.attachRecorder && msg.attachRecorder.length > 0) {
		let highlighter = createHighlighter();
		document.body.appendChild(highlighter);

		mouseevents = msg.attachRecorder[0];
		eventId = msg.attachRecorder[1];
		eventtype = msg.attachRecorder[2];

		recorder.attach(mouseevents, eventId, eventtype);
	}
	else if (msg.detachRecorder) {
		recorder.detach();
	}
	else if (msg.highlightViewport) {
		let matchedElement = createViewportElement();
		showHighlighterForElement(matchedElement);
	}
	else if (msg.removeViewportHighlight) {
		hideAllHighlighters();
	}
	else if (msg.highlightElements) {

		let matchedElements = getElements(msg.highlightElements);
		for (let ele of matchedElements) {
			showHighlighterForElement(ele);
		}
	}
	else if (msg.removeElementHighlight) {
		hideAllHighlighters();
	}
});