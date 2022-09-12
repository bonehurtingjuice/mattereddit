# Mattereddit
# Copyright 2018, 2022 Declan Hoare

import json
import threading
import traceback

from Reddit_ChatBot_Python import ChatBot, RedditAuthentication
import requests

sess = requests.Session()
with open("mattereddit.json") as f:
    config = json.load(f)

reddit_auth = RedditAuthentication.PasswordAuth(reddit_username=config["reddit"]["username"], reddit_password=config["reddit"]["password"])
bot = ChatBot(authentication=reddit_auth)
if "token" in config["matterbridge"]:
    sess.headers["Authorization"] = "Bearer " + config["matterbridge"]["token"]
mb_api = config["matterbridge"]["api"]
mb_gateway = config["matterbridge"]["gateway"]
re_user = config["reddit"]["username"]
re_room = "sendbird_group_channel_" + config["reddit"]["room"].split("/")[-1]


@bot.event.on_message
def on_message(resp):
    if resp.user.name == re_user:
        return
    if resp.channel_url != re_room:
        return
    if "snoomoji" in resp.v1:
        snoomoji = resp.v1.snoomoji
        if snoomoji == "snoo_biblethump":
            snoomoji = "snoo_cry"
        if snoomoji == "partyparrot":
            snoomoji += ".gif"
        else:
            snoomoji += ".png"
        text = "https://www.redditstatic.com/desktop2x/img/snoomoji/" + snoomoji
    else:
        text = resp.message
    sess.post(mb_api + "/api/message", data={"text": text, "username": resp.user.name, "gateway": mb_gateway})


def mb_watch():
    while True:
        try:
            for l in sess.get(mb_api + "/api/stream", stream=True).iter_lines():
                print(l)
                msg = json.loads(l)
                if msg["event"]:
                    continue
                if msg["gateway"] != mb_gateway:
                    continue
                bot.send_message(msg["username"] + msg["text"].replace("\n", " "), re_room)
        except:
            traceback.print_exc()


threading.Thread(target=mb_watch).start()
bot.run_4ever(auto_reconnect=True)
