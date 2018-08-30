// RedditChatClient
// Copyright 2018 Declan Hoare

// Instantiate this on a reddit.com/chat/r page to start talking to PhantomJS.
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
		let old = false;
		for (let mutation of mutations)
		{
			// When the page loads, there's a big mutation that removes
			// the "Loading history..." span and adds a lot of old
			// messages at once.  Don't fire events for it.
			for (let elem of mutation.removedNodes)
				if (elem.tagName === "SPAN")
					old = true;
			
			// Otherwise, process the new nodes
			for (let elem of mutation.addedNodes)
				this.parse(elem, old);
		}
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

module.exports = RedditChatClient;

