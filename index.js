// Mattereddit
// Copyright 2018 Declan Hoare

const request = require("request");
const JSONStream = require("JSONStream");
const puppeteer = require("puppeteer");
const eventstream = require("event-stream");
const fs = require("fs");

const config = JSON.parse(fs.readFileSync("mattereddit.json", "utf8"));

let headers = {"Content-Type": "application/json"};
if (config.matterbridge.token !== undefined)
	headers.Authorization = `Bearer ${config.matterbridge.token}`;

puppeteer.launch(config.puppeteer).then(async (browser) =>
{
	const page = await browser.newPage();
	let loggedin = false;
	await page.goto(config.reddit.room);
	if (await page.evaluate(() => location.pathname) === "/login")
	{
		await page.evaluate(function (username, password)
		{
			document.getElementById("loginUsername").value = username;
			document.getElementById("loginPassword").value = password;
			document.querySelector(".AnimatedForm__submitButton").click();
		}, config.reddit.username, config.reddit.password).then(() => page.waitForNavigation({ waitUntil: "load" }));
	}
	if (await page.evaluate(() => location.pathname) === "/login")
	{
		// If we're on the login page again then it failed...
		console.error("Login failed!");
		process.exit(1);
	}
	console.log(`logged into Reddit as ${config.reddit.username}`);
	await page.exposeFunction("onReady", function ()
	{
		console.log("Reddit chat ready");
		request(
		{
			url: `${config.matterbridge.api}/api/stream`,
			method: "GET",
			headers: headers
		}, function (error, response, body)
		{
			if (error !== null)
			{
				console.log(error);
				process.exit(1);
			}
		}).pipe(JSONStream.parse()).pipe(eventstream.map(async (message) =>
		{
			console.log(`inbound message ${JSON.stringify(message)}`);
			await page.evaluate((message) =>
			{
				rcc.sendMessage(message);
			}, message);
		}));
	});
	await page.exposeFunction("onMessage", function (message)
	{
		// add gateway to object so matterbridge knows where to send it
		message.gateway = config.matterbridge.gateway;
		console.log(`outbound message ${JSON.stringify(message)}`);
		request(
		{
			url: `${config.matterbridge.api}/api/message`,
			method: "POST",
			headers: headers,
			json: message
		}, function (error, response, body)
		{
			if (error !== null)
				console.log(error);
		});
	});
	await page.evaluate(function (username)
	{
		// Instantiate this on a reddit.com/chat/r page
		// This entire class is liable to break if the Reddit Chat DOM changes and it should
		// be replaced when Reddit exposes a public API that doesn't need a browser.
		class RedditChatClient
		{
			getElements()
			{
				this.room = this.messages = this.form = this.textarea = this.submit = null;
				
				// The only nav tag on the page contains some metadata about the
				// room itself.  Its parent is the root containing everything
				// the client is interested in on the page.
				let nav = this.doc.querySelector("nav");
				if (nav !== null)
				{
					this.room = nav.parentElement;
					
					// The immediate div grandchild is where the action happens, 
					// containing alternating bylines and messages in a flat tree.
					this.messages = this.room.querySelector(":scope > div > div");
					
					// The form (which for once has an ID) is used to enter and
					// send messages.
					this.form = this.doc.getElementById("MessageInputTooltip--Container");
					this.textarea = this.form.querySelector("textarea");
					this.submit = this.form.querySelector("button");
				}
				
				// If we didn't find everything we want so far then give up
				if (this.room === null || this.messages === null || this.form === null || this.textarea === null || this.submit === null)
				{
					throw new Error("Couldn't find the expected elements of a Reddit Community Chat page.");
				}
			}
			
			parseByline(elem)
			{
				let byh4 = elem.querySelector("h4"), byimg = elem.querySelector("img"), byi = elem.querySelector("i");
				if (byh4 !== null)
				{
					this.username = byh4.textContent;
					this.botmsg = this.username === this.botname;
				}
				if (byimg !== null)
					this.avatar = byimg.src;
				if (byi !== null)
				{
					// default avatars are <i> with background-image
					// instead of <img>, so here's the Webscale way to
					// get the background-image of an element in JS
					let style = window.getComputedStyle(byi);
					this.avatar = style.backgroundImage.slice(4, -1).replace(/"/g, "");
				}
			}
			
			// old is for when parsing old messages - we still need to scan
			// through them to get author info, but we shouldn't dispatch events
			parse(elem, old = false)
			{
				switch (elem.tagName)
				{
					case "A": // byline
						this.parseByline(elem);
						break;
					case "DIV": // new message
						if (old || this.botmsg)
							break;
						let message =
						{
							username: this.username,
							userid: this.username, // usernames are unique+unchangeable on reddit so this should work
							avatar: this.avatar,
							text: null
						};
						let msgpre = elem.querySelector("pre");
						if (msgpre !== null) // text message
						{
							// we can do more parsing here to figure out "u/"
							// mentions based on nested <a> tags if necessary
							message.text = msgpre.textContent;
						}
						let msgimg = elem.querySelector(":scope > div > div > img");
						if (msgimg !== null) // snoomoji
						{
							if (msgimg.src.includes("snoomoji")) // failsafe
								message.text = msgimg.src; // turn message into link to snoomoji
						}
						if (message.text !== null) // we found a usable message
						{
							this.onMessage(message);
						}
						break;
				}
			}
			
			// When the chat moves the observer will fire.  This flattens out
			// the sequence of records and lets us parse every new child of
			// the node without going through existing ones.
			watchcb(mutations)
			{
				for (let mutation of mutations)
				{	
					for (let elem of mutation.addedNodes)
						this.parse(elem, this.old);
				}
				// This variable lets us not dispatch events for the
				// first mutation because that's old messages loading in
				this.old = false;
			}
			
			// Set up the MutationObserver so that incoming messages can be processed
			installWatch()
			{
				this.watch = new MutationObserver(this.watchcb.bind(this));
				this.watch.observe(this.messages, { childList: true });
			}
			
			sendMessage(message)
			{
				// Format inbound message from Matterbridge API.  We can't do
				// anything with the avatar, but obviously show the username by
				// adding it into the message
				let msgstr = `${message.username}: ${message.text}`;
				this.textarea.value = msgstr;
				// Manually fire input event since it doesn't happen when
				// programatically changing textarea value
				this.textarea.dispatchEvent(new Event("input", {bubbles: true, cancelable: true}));
				this.submit.click();
			}
			
			initpage()
			{
				if (this.doc.querySelector("nav") === null)
					return false;
				this.getElements();
				
				// check last byline
				let atags = this.messages.querySelectorAll("a");
				console.log(atags);
				if (atags.length !== 0)
					this.parseByline(atags[atags.length - 1]);
				
				this.installWatch();
				this.onReady();
				return true;
			}
			
			constructor(botname, onReady, onMessage)
			{
				this.botmsg = false;
				this.botname = botname;
				this.onReady = onReady;
				this.onMessage = onMessage;
				
				this.doc = document;
				
				this.old = true;
				
				this.username = this.avatar = null;
				
				// If not enough elements have been added to set up yet, then
				// keep around a MutationObserver to keep checking when things
				// get added until we can.
				let ipthis = this.initpage.bind(this);
				if (!ipthis())
				{
					let obs = new MutationObserver(function ()
					{
						if (ipthis())
							obs.disconnect();
					});
					obs.observe(this.doc, { childList: true, subtree: true });
				}
			}
			
			// stop do and stop referencing event handlers - useless afterwards
			dispose()
			{
				this.watch.disconnect();
			}
		}
		window.rcc = new RedditChatClient(username, onReady, onMessage);
	}, config.reddit.username);
});


