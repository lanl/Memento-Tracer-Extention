/* jshint esversion:6 */
/* jshint strict: false */


describe ("Tracer Test Suite", function() {
	beforeEach( function() {
		
		this.trace = {
			"userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3431.0 Safari/537.36",
			"resourceURL": "https://www.slideshare.net/hvdsomp/paul-evan-peters-lecture",
			"traceName": "test",

			"actions": {
				"azxdfds22d": {
					"id": "azxdfds22d",
					"name": "Starting Resource",
					"uriPattern": "https://www.slideshare.net/[hvdsomp]/[paul-evan-peters-lecture]",
					"selectorId": [],
					"selectorType": [],
					"actionName": "load",
					"locationURL": "https://www.slideshare.net/hvdsomp/paul-evan-peters-lecture",
					"traceURL": null,
					"actionApply": "once",
					"repeat": 0,
					"parentId": "azxdfds22d",

					"children": {
						"bgsjlwp335n": {
							"id": "bgsjlwp335n",
							"parentId": "azxdfds22d",
							"name": "Next Slide",
							"uriPattern": null,
							"selectorId": ["div.j-next-btn.arrow-right"],
							"selectorType": ["CSSSelector"],
							"actionName": "click",
							"locationURL": "https://www.slideshare.net/hvdsomp/paul-evan-peters-lecture",
							"traceURL": null,
							"repeat": {
								"until": {
									"selectorType": ["locationURL"],
									"selectorCondition": "changes",
									"selectorId": []
								}
							}
						},
						"7654bfdgbnjk": {
							"id": "7654bfdgbnjk",
							"parentId": "azxdfds22d",
							"name": "Next Slide",
							"uriPattern": null,
							"selectorId": ["li.j-related-item a:first-of-type"],
							"selectorType": ["CSSSelector"],
							"actionName": "click",
							"locationURL": "https://www.slideshare.net/hvdsomp/perseverance-on-persistence",
							"traceURL": null,
							"repeat": {
								"until": {
									"selectorType": ["resourceCount"],
									"selectorCondition": "equals",
									"selectorId": ["5"]
								}
							},
							"children": {
								"hjs33fj0um": {
									"id": "hjs33fj0um",
									"parentId": "7654bfdgbnjk",
									"name": "Stats Tab",
									"uriPattern": null,
									"selectorId": ["a.j-stats-tab"],
									"selectorType": ["CSSSelector"],
									"actionName": "click",
									"locationURL": "https://www.slideshare.net/hvdsomp/perseverance-on-persistence",
									"traceURL": null,
									"repeat": 0
								}
							}
						},
					},
				}
			}
		};
	});

	it("checking if the trace has the starting resource", function() {
		expect(Object.keys(this.trace.actions).length).toEqual(1);
	});

	it("checking if getTracerEvent works (using BFS)", function() {

		let testTrace = new Trace();
		let tracerEvent1 = testTrace.getTracerEvent("hjs33fj0um", actions=this.trace.actions);
		expect(tracerEvent1.id).toEqual("hjs33fj0um");

		let tracerEvent2 = testTrace.getTracerEvent("7654bfdgbnjk", actions=this.trace.actions);
		expect(tracerEvent2.id).toEqual("7654bfdgbnjk");
		
		let tracerEvent3 = testTrace.getTracerEvent("bgsjlwp335n", actions=this.trace.actions);
		expect(tracerEvent3.id).toEqual("bgsjlwp335n");
		
		let tracerEvent4 = testTrace.getTracerEvent("azxdfds22d", actions=this.trace.actions);
		expect(tracerEvent4.id).toEqual("azxdfds22d");

		let tracerEvent5 = testTrace.getTracerEvent("notthere", actions=this.trace.actions);
		expect(tracerEvent5).toBe(null);
		
	});

	it("adding new child events", function() {
		let testTrace = new Trace();
		let startingEvent = new TracerEvent(eventName="Starting Resource",
			actionName="load");
		var success = testTrace.addTracerEvent(startingEvent);
		expect(success).toBe(true);
		expect(testTrace.actions[startingEvent.id]).toEqual(startingEvent);

		let event1 = new TracerEvent(eventName="Event 1",
			actionName="click",
			resourceUrl=null,
			parentId=startingEvent.id);
		var success1 = testTrace.addTracerEvent(event1);
		expect(success1).toBe(true);

		let event2 = new TracerEvent(eventName="Event 2",
			actionName="click",
			resourceUrl=null,
			parentId=event1.id);
		var success2 = testTrace.addTracerEvent(event2);
		expect(success2).toBe(true);

		expect(testTrace.getTracerEvent(event2.id));

	});

	it("shortest path", function() {
		let testTrace = Trace.fromJSON(this.trace);
		let path = testTrace.getShortestPath("7654bfdgbnjk");
		expect(path).toBe("azxdfds22d.7654bfdgbnjk");
	});

	it("to json", function() {
		let testTrace = Trace.fromJSON(this.trace);
		let jsonTrace = testTrace.toJSON();
		expect(typeof(jsonTrace)).toEqual("string");
		let jt = JSON.parse(jsonTrace);
		expect(jt).toEqual(jasmine.objectContaining({
			traceName: "test",
			uriPattern: "",
			uriRegex: ""
		}));

		expect(jt.actions["azxdfds22d"]["parentId"]).toBe("azxdfds22d");

	});

	it("testing createEventTypeChoices", function() {
		event_id = "azxdfds22d";
		let eventTypes = createEventTypeChoices(event_id, "click", asStr=false);
		for (let opts of eventTypes) {
			if (opts.search("<label") === 0) {
				expect(opts.search("action_type_" + event_id)).toBeGreaterThan(0);
			}
			if (opts.search("action_type_click_") > 0) {
				tagCloseIndex = opts.indexOf(">");
				expect(opts.search("action_type_click_" + event_id)).toBeGreaterThan(0);
				expect(opts.search("action_type_click_" + event_id)).toBeLessThan(tagCloseIndex);
				expect(opts.search("selected")).toBeGreaterThan(0);
				expect(opts.search("selected")).toBeLessThan(tagCloseIndex);
			}
			if (opts.search("action_type_select_all_links_") > 0) {
				tagCloseIndex = opts.indexOf(">");
				expect(opts.search("action_type_select_all_links_" + event_id)).toBeGreaterThan(0);
				expect(opts.search("action_type_select_all_links_" + event_id)).toBeLessThan(tagCloseIndex);
				expect(opts.search("selected")).toBeLessThan(0);
			}
		}	
		eventTypes = createEventTypeChoices(event_id, "select_all_links", asStr=false);
		for (let opts of eventTypes) {
			if (opts.search("<label") === 0) {
				expect(opts.search("action_type_" + event_id)).toBeGreaterThan(0);
			}
			if (opts.search("action_type_click_") > 0) {
				tagCloseIndex = opts.indexOf(">");
				expect(opts.search("action_type_click_" + event_id)).toBeGreaterThan(0);
				expect(opts.search("action_type_click_" + event_id)).toBeLessThan(tagCloseIndex);
				expect(opts.search("selected")).toBeLessThan(0);
			}
			if (opts.search("action_type_select_all_links_") > 0) {
				tagCloseIndex = opts.indexOf(">");
				expect(opts.search("action_type_select_all_links_" + event_id)).toBeGreaterThan(0);
				expect(opts.search("action_type_select_all_links_" + event_id)).toBeLessThan(tagCloseIndex);
				expect(opts.search("selected")).toBeGreaterThan(0);
				expect(opts.search("selected")).toBeLessThan(tagCloseIndex);
			}
		}
	});

	it("testing createClickExitCondition", function() {
		event_id = "azxdfds22d";
		let exitCond = createClickExitCondition(event_id, asStr=false);
		for (let cond of exitCond) {
			if (cond.search("<input") === 0 && cond.includes("radio")) {
				tagCloseIndex = cond.indexOf(">");
				expect(cond.search("exit_condition_" + event_id)).toBeGreaterThan(0);
			}
		}
	});


	it("delete event", function() {
		let testTrace = Trace.fromJSON(this.trace);
		let path = testTrace.deleteEvent("7654bfdgbnjk");
		expect(path).toBe(true);
		console.log(testTrace);
	});

	it("check regexp pattern", function() {
		let matched_urls = {
			"https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype?oldid=863945640": "https://[en].wikipedia.org/wiki/[[Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype]]?oldid=[863945640]",

			"https://figshare.com/articles/Segmental_Dynamics_of_Entangled_Poly_ethylene_oxide_Melts_Deviations_from_the_Tube-Reptation_Model/7458695": "https://figshare.com/articles/[Beyond_Throughput_a_4G_LTE_Dataset_with_Channel_and_Context_Metrics]/[6153497]",

			"https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype": "https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/[[Missing_articles_by_occupation/Researchers_-_Prototype]]",

			"https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype?ssk=dfdfsfsafafaf": "https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/[[Missing_articles_by_occupation/Researchers_-_Prototype]]",

			"https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers": "https://en.wikipedia.org/wiki/Wikipedia:[[WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype]]",

			"https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0167475": "https://journals.plos.org/plosone/article?id=[10.1371/journal.pone.0167475]",

			"https://www.seleniumhq.org/docs/00_Note_to-the-reader.jsp": "https://www.seleniumhq.org/docs/[00_Note_to-the-reader.jsp]",

			"https://www.slideshare.net/hvdsomp/perseverance-on-persistence": "https://www.slideshare.net/[hvdsomp]/[perseverance-on-persistence]",

			"https://github.com/gorilla/mux": "https://github.com/[gorilla]/[mux]",

			"https://github.com/gorilla/mux/issues": "https://github.com/[gorilla]/[mux]/issues",

			"https://github.com/gorilla/mux/issues/410":
			"https://github.com/[gorilla]/[mux]/issues/[410]",

			"https://github.com/gorilla/mux/issues/410#issue-370367509": "https://github.com/[gorilla]/[mux]/issues/[410#issue-370367509]",

			"https://www.heise.de/": "https://www.heise.de/$"
		};
		let unmatched_urls = {
			"https://wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype?oldid=863945640": "https://[en].wikipedia.org/wiki/[[Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype]]?oldid=[863945640]",

			"https://en.wikipedia.org/wiki/?oldid": "https://[en].wikipedia.org/wiki/[[Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype]]?oldid=[863945640]",

			"https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype?oldid": "https://[en].wikipedia.org/wiki/[[Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype]]?oldid=[863945640]",

			"https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype": "https://[en].wikipedia.org/wiki/[[Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype]]?oldid=[863945640]",

			"https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/": "https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/[[Missing_articles_by_occupation/Researchers_-_Prototype]]",

			"https://wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype": "https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/[[Missing_articles_by_occupation/Researchers_-_Prototype]]",

			"https://wikipedia.org/wiki/Wikipedia:WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers": "https://en.wikipedia.org/wiki/Wikipedia:[[WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype]]",

			"https://en.wikipedia.org/wiki/Wikipedia": "https://en.wikipedia.org/wiki/Wikipedia:[[WikiProject_Women_in_Red/Missing_articles_by_occupation/Researchers_-_Prototype]]",

			"https://journals.plos.org/plosone/article&id=10.1371/journal.pone.0167475": "https://journals.plos.org/plosone/article?id=[10.1371/journal.pone.0167475]",

			"https://journals.plos.org/plosone/article?i=10.1371/journal.pone.0167475&d=xxx": "https://journals.plos.org/plosone/article?id=[10.1371/journal.pone.0167475]",

			"https://journals.plos.org/plosone/article?i=10.1371/journal.pone.0167475": "https://journals.plos.org/plosone/article?id=[10.1371/journal.pone.0167475]",

			"https://seleniumhq.org/docs/00_Note_to-the-reader.jsp": "https://www.seleniumhq.org/docs/[00_Note_to-the-reader.jsp]",

			"https://www.slideshare.net/hvdsompperseverance-on-persistence": "https://www.slideshare.net/[hvdsomp]/[perseverance-on-persistence]",

			"https://github.com/gorilla/mux/issues": "https://github.com/[gorilla]/[mux]",

			"https://github.com/gorillamux": "https://github.com/[gorilla]/[mux]",

			"https://github.com/gorilla/mux/": "https://github.com/[gorilla]/[mux]/issues",

			"https://github.com/gorilla/mux/issues/410": "https://github.com/[gorilla]/[mux]/issues",

			"https://github.com/gorillamux/issues": "https://github.com/[gorilla]/[mux]/issues",

			"https://github.com/gorilla/mux/issues/410/sss": "https://github.com/[gorilla]/[mux]/issues/[410]",

			"https://github.com/gorilla/issues/410": "https://github.com/[gorilla]/[mux]/issues/[410]",

			"https://github.com/gorilla/mux/issue/410":
			"https://github.com/[gorilla]/[mux]/issues/[410]",

			"https://github.com/gorilla/mux/issue/410#issue-370367509": "https://github.com/[gorilla]/[mux]/issues/[410#issue-370367509]",

			"https://github.com/gorilla/mux/issues/": "https://github.com/[gorilla]/[mux]/issues/[410#issue-370367509]",

			"https://www.heise.de/articles/": "https://www.heise.de/$",
			"https://www.heise.de": "https://www.heise.de/$"
		};

		for (let url in matched_urls) {
			console.log("checking matching regex for: " + url);
			console.log("with pattern: " + matched_urls[url]);
			let r = createRegExpForPattern(matched_urls[url]);
			console.log(r);
			let re = new RegExp(r);
			res = re.exec(url);
			console.log(res);
			expect(res.length).toBeGreaterThan(0);
		}
		
		for (let url in unmatched_urls) {
			//console.log("checking unmatching regex for: " + url);
			//console.log("with pattern: " + unmatched_urls[url]);
			let r = createRegExpForPattern(unmatched_urls[url]);
			//console.log(r);
			let re = new RegExp(r);
			res = re.exec(url);
			expect(res).toBeNull();
		}
		
	});

});