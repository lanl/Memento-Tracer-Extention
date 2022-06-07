var popupId;

chrome.browserAction.onClicked.addListener(function () {

	chrome.tabs.query({}, function(tabs) {

		var createNewWindow = true;
		for (var i=tabs.length-1; i>=0; i--) {
		  if (tabs[i].url === "chrome-extension://" + chrome.runtime.id + "/popup.html") {
			//your popup is alive
			createNewWindow = false;
			chrome.tabs.update(tabs[i].id, {active: true}); //focus it
			break;
		  }
		}
		if (createNewWindow) { //it didn't find a window, so create it		
			chrome.windows.create({
				url: chrome.runtime.getURL("popup.html"),
				type: "popup",
				height: 1100,
				width: 500
			}, function(popup) {
				popupId = popup.id;
			});	
		} else {
			// it did find a window, but it might be buried, so bring it into focus
			chrome.windows.update(popupId, { "focused": true });
		}
	});

});

