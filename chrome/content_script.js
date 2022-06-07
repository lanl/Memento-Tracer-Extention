
/* jshint esversion:6 */
/* jshint strict: false */


// function toggleExtensionPane() {
// 	var sidePane = document.getElementById("boundarySidePane");
// 	var w = window,
//     d = document,
//     e = d.documentElement,
//     g = d.getElementsByTagName('body')[0],
//     width = w.innerWidth || e.clientWidth || g.clientWidth;
//     if (!g) {
//     	g = document.body;
//     }

// 	if (sidePane.style.width == "0px") {
// 		g.style.width = width - 425 + "px";
// 		sidePane.style.width = "425px";
// 	}
// 	else {
// 		g.style.width = width + "px";
// 		sidePane.style.width = "0px";
// 	}
// }

/*
function createExtensionPage() {
	var sidePane = document.createElement("iframe");
	sidePane.id = "boundarySidePane";
	sidePane.style.height = "100%";
	sidePane.style.width = "0px";
	sidePane.style.position = "fixed";
	sidePane.style.top = "0px";
	sidePane.style.right = "0px";
	sidePane.style.zIndex = "999999999";
	sidePane.frameBorder = "none";
	sidePane.scrolling = "no";
	sidePane.src = chrome.extension.getURL("popup.html");

	document.body.appendChild(sidePane);	
}

createExtensionPage();
*/
