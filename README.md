Mattereddit is a [Matterbridge](https://github.com/42wim/matterbridge)
API plugin allowing you to connect Reddit Community Chat to the various
chat services supported by Matterbridge.

Since Reddit does not provide a public API to interact with chat, the
Puppeteer headless browser is used, driven by Node.JS, to interact with
the end-user chat page, scanning for incoming messages and sending
outgoing ones.  This is a fragile and resource-intensive solution, and
should be superseded by the use of the official API once it becomes
available.  For this reason, this plugin is a temporary measure.

Matterbridge and Mattereddit are used by
[/r/bonehurtingjuice](https://reddit.com/r/bonehurtingjuice) to bridge
our Reddit and Discord general chatrooms.

## Example Configuration

### matterbridge.toml

```
[api]
[api.bhjgeneral]
BindAddress="127.0.0.1:4242"
Token="MATTERBRIDGE_TOKEN"
Buffer=1000

...

[[gateway]]
name="bhjgeneral"
enable=true

    [[gateway.inout]]
    account="api.bhjgeneral"
    channel="api"
```

Add these to your existing Matterbridge config to set up an API instance
that Mattereddit can connect to.

### mattereddit.json

```
{
	"reddit":
	{
		"username": "BHJMatterbridge",
		"password": "REDDIT_PASSWORD",
		"room": "https://www.reddit.com/chat/r/bonehurtingjuice/channel/814473_c092110c9476c2129151c240b7ccd2baa3af6b7d"
	},
	"matterbridge":
	{
		"api": "http://127.0.0.1:4242",
		"token": "MATTERBRIDGE_TOKEN",
		"gateway": "bhjgeneral"
	},
	"puppeteer":
	{
		"executablePath": "/usr/bin/chromium"
	}
}
```

This file should be in Mattereddit's working directory.

The "puppeteer" object is passed to puppeteer.launch().  You only need
to define it if puppeteer doesn't work by default.

