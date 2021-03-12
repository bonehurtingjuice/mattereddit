# Mattereddit 2 - "Farewell Edition"

Mattereddit is a [Matterbridge](https://github.com/42wim/matterbridge)
API plugin allowing you to connect Reddit Community Chat to the various
chat services supported by Matterbridge.

This version has been rewritten in Python, and no longer needs a
headless browser, but it's a bit late in the game, seeing as Reddit
Community Chat is set to shut down in less than 2 weeks.  Ah well.

Matterbridge and Mattereddit are used by [BHJ](http://bigchung.us) to
bridge our Reddit, Discord, and IRC chatrooms.

## Example Configuration

### matterbridge.toml

```
[api]
[api.bhjgeneral]
BindAddress="127.0.0.1:4242"
Token="MATTERBRIDGE_TOKEN"
Buffer=1000
RemoteNickFormat="{NICK}"

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
		"password": "reddit password",
		"room": "https://www.reddit.com/chat/r/bonehurtingjuice/channel/814473_c092110c9476c2129151c240b7ccd2baa3af6b7d"
	},
	"matterbridge":
	{
		"api": "http://127.0.0.1:4242",
		"token": "MATTERBRIDGE_TOKEN",
		"gateway": "bhjgeneral"
	}
}
```

This file should be in Mattereddit's working directory.

You can get the Reddit token with this script:

https://raw.githubusercontent.com/scrubjay55/Reddit_ChatBot_Python/master/dump_access_token/dump_access_token.py

(It's different from the token you get from the developer section)
