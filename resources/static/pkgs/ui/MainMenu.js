import Html from "/libs/html.js";
import { timeDifference } from "/libs/time.js";
import vfs from "/libs/vfs.js";
import LangManager from "../../libs/l10n/manager.js";
import { colors, idToColor, idToEmoji } from "../../libs/userTables.js";
import langManager from "../../libs/l10n/manager.js";
import appLib from "../../libs/appLib.js";

let wrapper;

const pkg = {
  name: "Main Menu",
  type: "app",
  privs: 0,
  start: async function (Root) {
    // Get the window body
    wrapper = new Html("div").class("ui", "main-menu").appendTo("body");

    window.desktopIntegration !== undefined &&
      window.desktopIntegration.ipc.send("setRPC", {
        details: "Chillin' in the main menu",
      });

    const Ui = Root.Processes.getService("UiLib").data;
    const Sfx = Root.Processes.getService("SfxLib").data;
    const User = Root.Processes.getService("UserSvc").data;
    const Parties = Root.Processes.getService("PartySvc").data;

    let currentMenuList;

    Ui.becomeTopUi(Root.Pid, wrapper);

    let ws = Root.Security.getSecureVariable("CHERRY_TREE_WS");

    let stepCount = 0;
    let screensaverTimeout;
    function logStep(reason = "Step") {
      stepCount++;
      console.log("[MainMenu]", stepCount + ":", reason);
    }

    let uFriendList = User.getFriendList() || [];

    logStep("MAIN MENU LOADED");

    let gameParties = [];
    let watchParties = [];
    let friendsList = [];
    let info = {
      id: -1,
      name: "Not logged in",
      extra: null,
    };
    if (ws) {
      logStep("There is a WebSocket detected");
      friendsList = (await ws.sendMessage({ type: "get-friends" })).result;
      gameParties = Parties.getPartyList();
      info = await User.getUserInfo(await Root.Security.getToken());
      logStep("Websocket message received");
    } else {
      logStep("No WebSocket detected");
    }

    let friendsPlaying = new Map();

    document.addEventListener("CherryTree.Core.ProcessStart", () => {
      let currentUi = Ui.getTopUi();
      // console.log("UI Info", currentUi, Root.Processes.get(currentUi));
      try {
        ws.sendMessage({
          type: "now-playing",
          message: Root.Processes.get(currentUi).name,
        });
      } catch (e) {}
    });
    document.addEventListener("CherryTree.Core.ProcessExit", () => {
      let currentUi = Ui.getTopUi();
      // console.log("UI Info", currentUi, Root.Processes.get(currentUi));
      try {
        ws.sendMessage({
          type: "now-playing",
          message: Root.Processes.get(currentUi).name,
        });
      } catch (e) {}
    });
    document.addEventListener("CherryTree.WebSocket.Message", (e) => {
      let s = e.detail;
      console.log("WS message on MainMenu", s);
      if (s.type === "watchParty") {
        console.log(s);
        let parsedData = JSON.parse(s.text);
        watchParties.push({ ...parsedData, from: s.from });
        Root.Libs.Notify.show(
          `${s.from.name} invites you to a watch party!`,
          `Head over to the Friends menu to join!`,
        );
      } else if (s.type === "now-playing") {
        if (s.data.who === info.id) return;
        friendsPlaying.set(s.data.who, s.data.app);
      }
    });
    document.addEventListener("CherryTree.Parties.List.Update", () => {
      gameParties = Parties.getPartyList();
    });

    await vfs.importFS();

    logStep("FileSystem loaded");

    async function giveUpToApp(launchPkg, launchArgs = undefined) {
      Sfx.playSfx("deck_ui_into_game_detail.wav");

      // let split = launchPkg.split(":");
      // let url = `/pkgs/${split[0]}/${split[1]}.js`;
      // let data = await import(url);

      // if (data.default) {
      //   try {
      //     ws.sendMessage({ type: "now-playing", message: data.default.name });
      //   } catch (e) {}
      // }

      // Ui.cleanup(Pid);
      Ui.transition("popOut", wrapper, 500, true);
      await Root.Libs.startPkg(launchPkg, launchArgs);
    }

    let topBarButtonList = [
      { label: LangManager.getString("menu.apps") },
      { label: LangManager.getString("menu.store") },
      { label: LangManager.getString("menu.friends") },
    ];

    let topBarButtons = topBarButtonList.map((button) => {
      return new Html("a").class("btn").text(button.label);
    });

    // let friendsCount = new Html("label").class("friends-count").text("0");
    // topBarButtons[1].append(friendsCount);

    const topBar = new Html("div")
      .class("main-menu-container")
      .appendMany(
        new Html("div")
          .class("left")
          .appendMany(
            new Html("div")
              .class("logo")
              .html(
                `<svg width="64" height="64" viewBox="0 0 234 234" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M109.773 42.176C109.773 42.176 138.096 107.194 109.773 137.753C85.0659 164.411 62.3095 150.106 62.3095 150.106" stroke="url(#paint0_linear_236_11)" stroke-width="10" stroke-linecap="round"/><path d="M143.582 15.519C143.582 15.519 113.024 30.4732 118.875 44.7773C126.892 64.3734 153.215 57.9214 172.841 49.9787C199.498 38.275 206 15.519 206 15.519H187.145C170.133 15.519 159.837 7.06618 143.582 15.519Z" fill="url(#paint1_linear_236_11)"/><path d="M128.628 40.2254C128.628 40.2254 144.233 40.2254 160.487 35.0239C176.742 29.8225 192.346 22.0203 192.346 22.0203" stroke="url(#paint2_linear_236_11)" stroke-width="3" stroke-linecap="round"/><path d="M109.773 42.176C109.773 42.176 159.837 61.6815 161.788 134.502C161.788 178.064 129.278 175.464 129.278 175.464" stroke="url(#paint3_linear_236_11)" stroke-width="10" stroke-linecap="round"/><circle cx="68.8114" cy="160.509" r="40.3114" fill="url(#paint4_linear_236_11)"/><mask id="mask0_236_11" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="28" y="120" width="82" height="81"><circle cx="68.8114" cy="160.509" r="40.3114" fill="url(#paint5_linear_236_11)"/></mask><g mask="url(#mask0_236_11)"><mask id="mask1_236_11" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="28" y="120" width="82" height="81"><circle cx="68.8114" cy="160.509" r="40.3114" fill="url(#paint6_linear_236_11)"/></mask><g mask="url(#mask1_236_11)"><g style="mix-blend-mode:plus-lighter" opacity="0.56"><path d="M38.9434 152.707C38.4409 144.905 42.4106 129.301 62.3095 129.301" stroke="white" stroke-opacity="0.1" stroke-width="5" stroke-linecap="round"/></g><g style="mix-blend-mode:plus-lighter" opacity="0.56"><circle cx="38.2527" cy="162.46" r="3.25092" fill="white" fill-opacity="0.1"/></g><g style="mix-blend-mode:overlay"><path fill-rule="evenodd" clip-rule="evenodd" d="M62.3095 190.418C85.291 190.418 103.921 171.788 103.921 148.806C103.921 145.29 103.485 141.876 102.664 138.615C106.75 144.919 109.123 152.437 109.123 160.509C109.123 182.773 91.0747 200.821 68.8113 200.821C52.676 200.821 38.7548 191.341 32.3136 177.647C39.8845 185.519 50.5249 190.418 62.3095 190.418Z" fill="url(#paint7_linear_236_11)"/></g></g></g><circle cx="132.529" cy="181.315" r="40.3114" fill="url(#paint8_linear_236_11)"/><mask id="mask2_236_11" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="92" y="141" width="81" height="81"><circle cx="132.529" cy="181.315" r="40.3114" fill="url(#paint9_linear_236_11)"/></mask><g mask="url(#mask2_236_11)"><g style="mix-blend-mode:plus-lighter" opacity="0.56"><path d="M102.661 173.513C102.159 165.711 106.129 150.106 126.027 150.106" stroke="white" stroke-opacity="0.1" stroke-width="5" stroke-linecap="round"/></g><g style="mix-blend-mode:plus-lighter" opacity="0.56"><circle cx="101.971" cy="183.266" r="3.25092" fill="white" fill-opacity="0.1"/></g><g style="mix-blend-mode:overlay"><path fill-rule="evenodd" clip-rule="evenodd" d="M126.027 211.224C149.009 211.224 167.639 192.593 167.639 169.612C167.639 166.096 167.203 162.682 166.382 159.42C170.468 165.725 172.841 173.243 172.841 181.315C172.841 203.579 154.793 221.627 132.529 221.627C116.394 221.627 102.473 212.147 96.0316 198.453C103.602 206.325 114.243 211.224 126.027 211.224Z" fill="url(#paint10_linear_236_11)"/></g></g><defs><linearGradient id="paint0_linear_236_11" x1="92.3351" y1="42.176" x2="92.3351" y2="153.939" gradientUnits="userSpaceOnUse"><stop stop-color="#57A34B"/><stop offset="1" stop-color="#448239"/></linearGradient><linearGradient id="paint1_linear_236_11" x1="165.039" y1="12.2676" x2="165.039" y2="51.2786" gradientUnits="userSpaceOnUse"><stop stop-color="#3B8F49"/><stop offset="1" stop-color="#256730"/></linearGradient><linearGradient id="paint2_linear_236_11" x1="128.628" y1="21.3701" x2="128.628" y2="43.4763" gradientUnits="userSpaceOnUse"><stop stop-color="#2B6C35"/><stop offset="1" stop-color="#215028"/></linearGradient><linearGradient id="paint3_linear_236_11" x1="135.78" y1="42.176" x2="135.78" y2="175.493" gradientUnits="userSpaceOnUse"><stop stop-color="#62B255"/><stop offset="1" stop-color="#3C7733"/></linearGradient><linearGradient id="paint4_linear_236_11" x1="68.8114" y1="120.198" x2="68.8114" y2="200.821" gradientUnits="userSpaceOnUse"><stop stop-color="#B5102E"/><stop offset="1" stop-color="#930C24"/></linearGradient><linearGradient id="paint5_linear_236_11" x1="68.8114" y1="120.198" x2="68.8114" y2="200.821" gradientUnits="userSpaceOnUse"><stop stop-color="#B5102E"/><stop offset="1" stop-color="#930C24"/></linearGradient><linearGradient id="paint6_linear_236_11" x1="68.8114" y1="120.198" x2="68.8114" y2="200.821" gradientUnits="userSpaceOnUse"><stop stop-color="#C91939"/><stop offset="1" stop-color="#9B0F28"/></linearGradient><linearGradient id="paint7_linear_236_11" x1="74.0128" y1="195.619" x2="107.822" y2="166.361" gradientUnits="userSpaceOnUse"><stop stop-opacity="0.16"/><stop offset="1" stop-opacity="0.3"/></linearGradient><linearGradient id="paint8_linear_236_11" x1="132.529" y1="141.004" x2="132.529" y2="221.627" gradientUnits="userSpaceOnUse"><stop stop-color="#C91939"/><stop offset="1" stop-color="#9B0F28"/></linearGradient><linearGradient id="paint9_linear_236_11" x1="132.529" y1="141.004" x2="132.529" y2="221.627" gradientUnits="userSpaceOnUse"><stop stop-color="#C91939"/><stop offset="1" stop-color="#9B0F28"/></linearGradient><linearGradient id="paint10_linear_236_11" x1="137.731" y1="216.425" x2="171.54" y2="187.167" gradientUnits="userSpaceOnUse"><stop stop-opacity="0.16"/><stop offset="1" stop-opacity="0.4"/></linearGradient></defs></svg>`,
              ),
            new Html("div").class("buttons").appendMany(...topBarButtons),
          ),
        // new Html("div").class("right").appendMany(
        //   new Html("div")
        //     .class("icon", "gamepad-indicator")
        //     .html(
        //       `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gamepad-2"><line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>`
        //     )
        //     .style({ color: "var(--current-player)" }),
        //   new Html("span")
        //     .class("title")
        //     // .styleJs({
        //     //   border: "4px solid #114499",
        //     //   borderRadius: "8px",
        //     //   padding: "8px",
        //     // })
        //     .text(info.name)
        // )
      )
      .appendTo(wrapper);

    // const container = new Html("div").class('main-menu-attached').style({'width':'100%'}).appendTo(wrapper);

    const gamePreview = new Html("div")
      .styleJs({
        display: "flex",
        flexDirection: "column",
        height: "10rem",
        width: "100%",
        padding: "0 9rem 8rem 9rem",
        background: "#0004",
      })
      .appendTo(wrapper)
      .appendMany(new Html("br").styleJs({ height: "50%" }));

    let gameTitle = new Html("h1").text("Game name").appendTo(gamePreview);
    let gameDescription = new Html("p")
      .text("No description provided.")
      .appendTo(gamePreview);

    const gameList = new Html("div")
      .class("flex-row", "game-list")
      .appendTo(wrapper)
      .appendMany();

    let gamesList;
    let opened;
    let changed = false;

    let cover = new Html("img")
      .styleJs({
        zIndex: -1,
        filter: "brightness(20%)",
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        opacity: "0",
        aspectRatio: "16 / 9",
        objectFit: "cover",
        transition: "all 0.2s linear",
      })
      .appendTo("body");

    let coverVisible = false;

    function initScreensaver() {
      console.log("Screensaver starting...");
      screensaverTimeout = setTimeout(async () => {
        if (coverVisible) {
          cover.styleJs({ opacity: "0" });
        }
        Ui.transition("popOut", wrapper, 500, true);
        await Root.Libs.startPkg("ui:ScreenSaver", undefined);
      }, 60000);
    }

    function changePreview(id, coverEnabled = true) {
      let game = gamesList[id];
      console.log(game.preview);
      if (!game.preview) {
        setTimeout(() => {
          cover.styleJs({ opacity: "0" });
        }, 100);
        gameTitle.text(game.name);
        gameDescription.text("No description provided");
        return;
      }
      if (coverEnabled) {
        if (game.preview.image) {
          cover.attr({ src: game.preview.image });
          cover.elm.addEventListener("load", () => {
            setTimeout(() => {
              coverVisible = true;
              cover.styleJs({ opacity: "1" });
            }, 200);
          });
        } else {
          setTimeout(() => {
            coverVisible = false;
            cover.styleJs({ opacity: "0" });
          }, 200);
        }
      }
      gameTitle.text(game.preview.title ? game.preview.title : game.name);
      gameDescription.text(
        game.preview.description
          ? game.preview.description
          : "No description provided",
      );
    }

    async function populateAppList() {
      gameList.clear();
      let gameListData = JSON.parse(
        await vfs.readFile("Root/CherryTree/user/apps.json"),
      );

      if (gameListData === null) {
        // Attempt refresh of VFS to get a default gameListData.
        await vfs.merge();
        gameListData = JSON.parse(
          await vfs.readFile("Root/CherryTree/user/apps.json"),
        );
      }

      gamesList = gameListData.list;

      let gamesListHtml = gamesList.map((m, index) => {
        return new Html("button")
          .class("game")
          .styleJs({
            background: m.color,
            backgroundPosition: "center",
            backgroundSize: "45%",
            backgroundRepeat: "no-repeat",
            backgroundImage: `url("${m.image}")`,
          })
          .on("click", async (e) => {
            if (m.id !== undefined) {
              await appLib.launchApp(m.id);
              await appLib.sortAppList();
              setTimeout(async () => {
                await populateAppList();
                Ui.update(Root.Pid, uiArrays);
                Ui.updatePos(Root.Pid, { x: 0, y: 1 });
              }, 500);
            } else {
              await appLib.resetAppList();
              await Root.Libs.Modal.Show({
                parent: document.body,
                pid: Root.Pid,
                title: langManager.getString("menu.missingAppId.title"),
                description: langManager.getString(
                  "menu.missingAppId.description",
                ),
                buttons: [
                  {
                    type: "primary",
                    text: langManager.getString("actions.ok"),
                  },
                ],
              });
              location.reload();
            }
            if (m.launchPkg) {
              clearTimeout(screensaverTimeout);
              opened = index;
              coverVisible = false;
              cover.styleJs({ opacity: "0" });
              console.log("Opened app", opened);
              console.log(gamesList[opened]);

              document.addEventListener(
                "CherryTree.Ui.ChangePreview",
                async (e) => {
                  changed = true;
                  gamesList[0].preview = e.detail;
                  changePreview(0, false);
                  console.log(gamesList);
                  let updatedFile = {
                    last_updated: Date.now(),
                    list: gamesList,
                  };
                  await vfs.writeFile(
                    "Root/CherryTree/user/apps.json",
                    JSON.stringify(updatedFile),
                  );
                },
              );
              await giveUpToApp(m.launchPkg, m.launchArgs);
            } else if (m.launchUrl) {
              // Click the URL.
              let x = new Html("a")
                .attr({ href: m.launchUrl })
                .class("hidden")
                .appendTo("body");
              x.elm.click();
              setTimeout(() => {
                x.cleanup();
              });
            }
          })
          .appendMany(
            new Html("span")
              .class("game-under-text")
              .appendMany(
                new Html("span").class("game-name").text(m.name),
                new Html("span")
                  .class("game-play-time")
                  .text(
                    "last played " + timeDifference(new Date(), m.lastPlayed),
                  ),
              ),
          );
      });
      gameList.appendMany(...gamesListHtml);
    }

    const topBarBtnHtml = topBarButtons.map((m) => m.elm);

    let storeList = new Html("div")
      .class("flex-row", "game-list")
      .appendTo(wrapper);

    //#region More Tab
    const moreList = new Html("div")
      .class("home-menu-section", "main-menu-attached", "flex-col")
      .appendTo(wrapper);

    if (window.isOffline) {
      new Html("h2")
        .text(langManager.getString("system.offlineMenu.title"))
        .appendTo(moreList);
      new Html("p")
        .text(langManager.getString("system.offlineMenu.description"))
        .appendTo(moreList);
    }

    console.log(friendsList);

    let friendListWrapper = new Html("div").class("flex-list");

    let friendListHtml = [],
      incomingFriendListHtml = [],
      outgoingFriendListHtml = [],
      gamePartyListHtml = [],
      watchPartyListHtml = [];

    let friendListWrapperWrapper,
      outgoingFriendList,
      incomingFriendList,
      gamePartyList,
      watchPartyList;

    let friendTitle = new Html("h1").text("Friends").appendTo(moreList);

    const friendList = new Html("div").class("flex-col").appendTo(moreList);

    if (window.isOffline) {
      moreList.elm.removeChild(friendTitle.elm);
      moreList.elm.removeChild(friendList.elm);
    }

    function renderUserButton(user) {
      return new Html("button")
        .class("auto", "flex-col", "transparent")
        .appendMany(
          new Html("div")
            .class("flex-list", "flex-center")
            .style({
              width: "12.5rem",
              height: "12.5rem",
              background: `${idToColor(user.id)}`,
              "border-radius": "0.15rem",
            })
            .append(
              new Html("span")
                .style({
                  "background-color": "rgba(0,0,0,0.2)",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  "justify-content": "center",
                  "align-items": "center",
                  "font-size": "4.5rem",
                  flex: "1",
                })
                .text(idToEmoji(user.id)),
            ),
          new Html("span").class("title").text(user.name),
        );
    }

    function rerenderFriends() {
      friendListHtml = [];
      incomingFriendListHtml = [];
      outgoingFriendListHtml = [];
      gamePartyListHtml = [];
      watchPartyListHtml = [];

      let mergedFriends = friendsList.map((usr) => {
        uFriendList.forEach((uUsr) => {
          if (usr.id === uUsr.id) {
            usr.status = uUsr.data.status;
          }
        });
        return usr;
      });

      console.log(uFriendList, friendsList);

      const updatedFriends = mergedFriends.sort((friendA, friendB) => {
        // Sort by status (0/1) first, then by name (a-z) for each case
        let statusComparison = friendB.status - friendA.status;
        if (statusComparison !== 0) {
          return statusComparison;
        } else {
          const nameA = friendA.data?.name || "";
          const nameB = friendB.data?.name || "";
          return nameA.localeCompare(nameB);
        }
      });

      console.log(updatedFriends);

      if (updatedFriends.length > 0) {
        friendListHtml.push(
          ...updatedFriends.map((f) => {
            let label, button;

            button = renderUserButton(f);

            label = new Html("label").text(
              `last online ${timeDifference(
                new Date(),
                new Date(f.lastOnline),
              )}`,
            );

            if (f.status === 1) {
              label
                .classOn("positive-text")
                .text(
                  friendsPlaying.has(f.id)
                    ? friendsPlaying.get(f.id)
                    : "online",
                );
            }

            label.appendTo(button);

            return button;
          }),
        );
      }

      // Outgoing friend list support
      outgoingFriendListHtml.push(
        ...uFriendList
          .filter((f) => f.type === "outgoing")
          .map((f, n) => {
            return new Html("button")
              .class("auto", "flex-col", "transparent")
              .appendMany(
                new Html("div")
                  .class("flex-list", "flex-center")
                  .style({
                    width: "12.5rem",
                    height: "12.5rem",
                    background: `var(--controller-color-${f.id % 5})`,
                    "border-radius": "0.15rem",
                  })
                  .append(new Html("span").style({ flex: "1" }).text(f.id)),
                new Html("span").class("title").text(f.data.name),
                new Html("label").text(
                  `last online ${timeDifference(
                    new Date(),
                    new Date(f.data.lastOnline),
                  )}`,
                ),
              );
          }),
      );

      // Incoming friend list support
      incomingFriendListHtml.push(
        ...uFriendList
          .filter((f) => f.type === "incoming")
          .map((f, n) => {
            return new Html("button")
              .class("auto", "flex-col", "transparent")
              .appendMany(
                new Html("div")
                  .class("flex-list", "flex-center")
                  .style({
                    width: "12.5rem",
                    height: "12.5rem",
                    background: `var(--controller-color-${f.id % 5})`,
                    "border-radius": "0.15rem",
                  })
                  .append(new Html("span").style({ flex: "1" }).text(f.id)),
                new Html("span").class("title").text(f.data.name),
                new Html("label").text(`wants to be your friend`),
              )
              .on("click", async (e) => {
                let result = await Root.Libs.Modal.Show({
                  title: `Friend request ${
                    f.type === "incoming" ? "from" : "to"
                  } ${f.data.name}`,
                  description: "What do you want to do?",
                  pid: Root.Pid,
                  parent: document.body,
                  buttons: [
                    { type: "positive", text: "Accept" },
                    { type: "negative", text: "Deny" },
                    { type: "primary", text: "Cancel" },
                  ],
                });

                let choice = result.id;

                if (choice === 0) {
                  // Accept
                  let response = (
                    await ws.sendMessage({
                      type: "accept-friend-request",
                      message: String(f.id),
                    })
                  ).result;

                  console.log(response);
                } else if (choice === 1) {
                  // Deny
                  let response = (
                    await ws.sendMessage({
                      type: "reject-friend-request",
                      message: String(f.id),
                    })
                  ).result;

                  console.log(response);
                }
              });
          }),
      );

      watchPartyListHtml.push(
        ...watchParties.map((party) => {
          let button = new Html("button")
            .class("auto", "flex-col", "transparent")
            .appendMany(
              new Html("div")
                .class("flex-list", "flex-center")
                .style({
                  width: "12.5rem",
                  height: "12.5rem",
                  background: `${idToColor(party.from.id)}`,
                  "border-radius": "0.15rem",
                })
                .append(
                  new Html("span")
                    .style({
                      "background-color": "rgba(0,0,0,0.2)",
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      "justify-content": "center",
                      "align-items": "center",
                      "font-size": "4.5rem",
                      flex: "1",
                    })
                    .text(idToEmoji(party.from.id)),
                ),
              new Html("span").class("title").text(party.from.name),
            )
            .on("click", async () => {
              clearTimeout(screensaverTimeout);
              let userResult = await Root.Libs.Modal.Show({
                title: "Watch Party Invite",
                description: `${party.from.name} has invited you to watch\n ${party.name}`,
                parent: document.body,
                pid: await Ui.getTopUi(),
                buttons: [
                  { type: "default", text: "Accept" },
                  { type: "default", text: "Ignore" },
                ],
              });
              console.log(userResult);
              if (!userResult.cancelled) {
                const accepted = userResult.id === 0 ? true : false;
                if (accepted) {
                  clearTimeout(screensaverTimeout);
                  await Root.Libs.startPkg(
                    "apps:VideoPlayer",
                    [
                      {
                        app: "video",
                        watchParty: true,
                        partyCode: party.partyId,
                        partyName: party.name,
                      },
                    ],
                    true,
                  );
                }
              }
            });
          let trimmed =
            party.name.length > 20
              ? party.name.slice(0, 20) + "..."
              : party.name;
          new Html("label").text(trimmed).appendTo(button);
          return button;
        }),
      );

      gamePartyListHtml.push(
        ...gameParties.map((party) => {
          let button = new Html("button")
            .class("auto", "flex-col", "transparent")
            .appendMany(
              new Html("div")
                .class("flex-list", "flex-center")
                .style({
                  width: "12.5rem",
                  height: "12.5rem",
                  background: `${idToColor(party.host.id)}`,
                  "border-radius": "0.15rem",
                })
                .append(
                  new Html("span")
                    .style({
                      "background-color": "rgba(0,0,0,0.2)",
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      "justify-content": "center",
                      "align-items": "center",
                      "font-size": "4.5rem",
                      flex: "1",
                    })
                    .text(idToEmoji(party.host.id)),
                ),
              new Html("span").class("title").text(party.host.name),
            )
            .on("click", () => {
              alert("Not implemented yet!");
            });
          let trimmed =
            party.info.partyName.length > 20
              ? party.info.partyName.slice(0, 20) + "..."
              : party.info.partyName;
          new Html("label").text(trimmed).appendTo(button);
          return button;
        }),
      );

      if (incomingFriendListHtml.length === 0) {
        incomingFriendListHtml = [
          new Html("button").class("invisible").text("Nothing to see here.."),
        ];
      }
      if (outgoingFriendListHtml.length === 0) {
        outgoingFriendListHtml = [
          new Html("button").class("invisible").text("Nothing to see here.."),
        ];
      }

      if (gamePartyListHtml.length === 0) {
        gamePartyListHtml = [
          new Html("button")
            .class("invisible")
            .text("No active game parties.."),
        ];
      }

      if (watchPartyListHtml.length === 0) {
        watchPartyListHtml = [
          new Html("button")
            .class("invisible")
            .text("No active watch parties.."),
        ];
      }

      friendListHtml.unshift(
        new Html("button")
          .class("auto", "flex-col", "transparent")
          .styleJs({ alignSelf: "flex-start" })
          .appendMany(
            new Html("div")
              .class("flex-list", "flex-center")
              .styleJs({
                width: "12.5rem",
                height: "12.5rem",
                borderRadius: "0.15rem",
              })
              .html(
                `<svg style="width: 8rem;height: 8rem;" width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 100C0 44.7715 44.7715 0 100 0V0C155.228 0 200 44.7715 200 100V100C200 155.228 155.228 200 100 200V200C44.7715 200 0 155.228 0 100V100Z" fill="#2E2C3A"/>
                    <path d="M68.5 100H131.5" stroke="white" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M100 68.5V131.5" stroke="white" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>`,
              ),
            new Html("span").class("title").text("Add Friend"),
          )
          .on("click", async (e) => {
            clearTimeout(screensaverTimeout);
            let options = {
              title: "Add a Friend",
              description: "Enter your friend's Cherries account name",
              parent: document.body,
              pid: Root.Pid,
              value: "",
              type: "text",
            };

            let result = await Root.Libs.Modal.showKeyboard(options);

            if (result.canceled === true) {
              initScreensaver();
              return;
            }

            let data = await ws.sendMessage({
              type: "send-friend-request",
              message: result.value,
            });
            initScreensaver();
          }),
      );

      if (friendListWrapperWrapper !== undefined) {
        friendListWrapperWrapper.cleanup();
        outgoingFriendList.cleanup();
        incomingFriendList.cleanup();
        gamePartyList.cleanup();
        watchPartyList.cleanup();
      }

      friendListWrapper.html("").appendMany(...friendListHtml);

      friendListWrapperWrapper = new Html("div")
        .class("home-menu-section", "flex-col")
        .appendMany(friendListWrapper)
        .appendTo(friendList);

      outgoingFriendList = new Html("div")
        .class("flex-col")
        .appendMany(
          new Html("h1").class("title").text("outgoing friend requests"),
          new Html("div")
            .class("flex-list")
            .appendMany(...outgoingFriendListHtml),
        )
        .appendTo(friendList);

      incomingFriendList = new Html("div")
        .class("flex-col")
        .appendMany(
          new Html("h1").class("title").text("incoming friend requests"),
          new Html("div")
            .class("flex-list")
            .appendMany(...incomingFriendListHtml),
        )
        .appendTo(friendList);

      gamePartyList = new Html("div")
        .class("flex-col")
        .appendMany(
          new Html("h1").class("title").text("game parties"),
          new Html("div").class("flex-list").appendMany(...gamePartyListHtml),
        )
        .appendTo(friendList);

      watchPartyList = new Html("div")
        .class("flex-col")
        .appendMany(
          new Html("h1").class("title").text("watch parties"),
          new Html("div").class("flex-list").appendMany(...watchPartyListHtml),
        )
        .appendTo(friendList);

      currentMenuList = [
        friendListWrapper.elm.children,
        outgoingFriendListHtml,
        incomingFriendListHtml,
        gamePartyListHtml,
        watchPartyListHtml,
      ];
    }

    rerenderFriends();
    //#endregion

    function showTabs(x) {
      switch (x) {
        case 0:
          // Show games list
          if (coverVisible) {
            cover.styleJs({ opacity: "1" });
          }
          gamePreview.styleJs({ display: "flex" });
          gameList.classOff("hidden");
          storeList.classOn("hidden");
          moreList.classOn("hidden");
          break;
        case 1:
          // Show friend list
          coverVisible = false;
          cover.styleJs({ opacity: "0" });
          gamePreview.styleJs({ display: "none" });
          gameList.classOn("hidden");
          storeList.classOff("hidden");
          moreList.classOn("hidden");
          break;
        case 2:
          // Show friend list
          coverVisible = false;
          cover.styleJs({ opacity: "0" });
          gamePreview.styleJs({ display: "none" });
          gameList.classOn("hidden");
          storeList.classOn("hidden");
          moreList.classOff("hidden");
          break;
      }
    }

    const lastXPositions = [0, 0, 0];

    let curY = 0;
    let lastY = 0;
    let justOnTabs = false;
    let selectedTab = 0;
    let lastSelectedTab = 0;
    // let lastSelectedTabInTabList = 0;
    // let actualSelectedTab = 0;

    showTabs(0);

    currentMenuList = [gameList.elm.children];

    let uiArrays = [
      topBarBtnHtml,
      ...currentMenuList,
      // buttonList.elm.children,
    ];

    Ui.transition("popIn", wrapper);

    Ui.init(
      Root.Pid,
      "horizontal",
      [topBarBtnHtml, ...currentMenuList],
      async function parentCallback(n) {
        clearTimeout(screensaverTimeout);
        initScreensaver();
        // This is called after the input
        lastY = n.y;
        let curX = n.x;

        if (lastY !== curY) {
          if (lastY === 0) {
            if (selectedTab !== curX) {
              Ui.updatePos(Root.Pid, { x: selectedTab, y: 0 });
            }

            curX = selectedTab;

            console.log("Moved up to top tab?", selectedTab);
          }
        }
        curY = n.y;
        if (curY === 0) {
          if (lastSelectedTab !== curX) {
            Sfx.playSfx("deck_ui_tab_transition_01.wav");
            selectedTab = curX;
          }
          lastSelectedTab = selectedTab;

          topBarBtnHtml.forEach((c) => c.classList.remove("selected"));
          topBarBtnHtml[selectedTab].classList.add("selected");

          uiArrays = [topBarBtnHtml];

          if (selectedTab === 0) {
            uiArrays[1] = gameList.elm.children;
          } else if (selectedTab === 2) {
            // Agh
            uFriendList = User.getFriendList();
            rerenderFriends();
            // oops
            if (window.isOffline) {
              uiArrays = [topBarBtnHtml];
            } else {
              uiArrays = [
                topBarBtnHtml,
                friendListWrapper.elm.children,
                outgoingFriendListHtml.map((m) => m.elm),
                incomingFriendListHtml.map((m) => m.elm),
                gamePartyListHtml.map((m) => m.elm),
                watchPartyListHtml.map((m) => m.elm),
              ];
            }
          }
          showTabs(selectedTab);
          Ui.update(Root.Pid, uiArrays);
        } else {
          lastXPositions[selectedTab] = curX;
        }
        console.log("Selected tab", selectedTab);
        console.log("Current Y", curY);
        console.log("Current X", curX);
        if (selectedTab == 0 && curY == 1) {
          changePreview(curX);
        }
      },
    );

    await populateAppList();
    Ui.update(Root.Pid, uiArrays);
    Ui.updatePos(Root.Pid, { x: 0, y: 1 });
    changePreview(0);
    document.addEventListener("CherryTree.Ui.ExitApp", async (e) => {
      if (changed) {
        changePreview(0);
      } else {
        coverVisible = true;
        cover.styleJs({ opacity: "1" });
      }
      initScreensaver();
    });
    initScreensaver();
  },
  end: async function () {
    // Close the window when the process is exited
    wrapper.cleanup();
  },
};

export default pkg;
