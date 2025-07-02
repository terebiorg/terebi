import Html from "/libs/html.js";
import Ws from "/libs/windowSystem.js";
import Keyboard from "/libs/keyboard.js";
import settingsLib from "../../libs/settingsLib.js";
import langManager from "../../libs/l10n/manager.js";
import TabbedUI from "../../libs/tabbedUI.js";

let wrapper, Ui, Pid, Sfx;

const pkg = {
  name: "Settings",
  type: "app",
  privs: 0,
  start: async function (Root) {
    Pid = Root.Pid;

    Ui = Root.Processes.getService("UiLib").data;
    let Users = Root.Processes.getService("UserSvc").data;

    wrapper = new Html("div").class("full-ui").appendTo("body");

    window.desktopIntegration !== undefined &&
      window.desktopIntegration.ipc.send("setRPC", {
        details: "Configuring settings",
      });

    Ui.transition("popIn", wrapper);

    Ui.becomeTopUi(Root.Pid, wrapper);

    Sfx = Root.Processes.getService("SfxLib").data;

    const Background = Root.Processes.getService("Background").data;
    console.log(Sfx);

    let tabs = {
      Setup: (wrapper, ui) => {
        wrapper.styleJs({
          padding: "20px",
        });
        new Html("h1")
          .text(langManager.getString("settings.categories.setup.title"))
          .appendTo(wrapper);
        new Html("p")
          .text(langManager.getString("settings.categories.setup.description"))
          .appendTo(wrapper);
        new Html("br").appendTo(wrapper);
        const row0 = new Html("div").class("flex-list").appendTo(wrapper);

        row0.appendMany(
          new Html("button")
            .text(
              langManager.getString("settings.categories.setup.items.userInfo"),
            )
            .on("click", async (e) => {
              await Ui.giveUpUi(Root.Pid, true);

              await Root.Libs.Modal.showWithoutButtons(
                "Loading",
                "Downloading user data...",
                wrapper,
                Root.Pid,
                async function (a) {
                  let info = await Users.getUserInfo(
                    await Root.Security.getToken(),
                  );
                  a();
                  setTimeout(() => {
                    Root.Libs.Modal.Show({
                      parent: wrapper,
                      pid: Root.Pid,
                      title: langManager.getString(
                        "settings.categories.setup.items.userInfoTitle",
                      ),
                      description: JSON.stringify(info, null, 4),
                      buttons: [
                        {
                          type: "primary",
                          text: "OK",
                        },
                      ],
                    });
                  }, 500);
                },
              );
            }),
          new Html("button")
            .text(
              langManager.getString("settings.categories.setup.items.logout"),
            )
            .on("click", async (e) => {
              // Delegate UI while loading the app
              let result = await Root.Libs.Modal.Show({
                parent: wrapper,
                pid: Root.Pid,
                title: langManager.getString(
                  "settings.categories.setup.items.logoutTitle",
                ),
                description: langManager.getString(
                  "settings.categories.setup.items.logoutDescription",
                ),
                buttons: [
                  {
                    type: "primary",
                    text: "No",
                  },
                  {
                    type: "negative",
                    text: "Yes",
                  },
                ],
              });

              // Delegate UI while loading the app
              // Ui.transition("popOut", wrapper, 500, true);
              // await Root.Libs.startPkg("system:Oobe", [], true);
            }),
          new Html("button")
            .text(
              langManager.getString("settings.categories.setup.items.delete"),
            )
            .on("click", async (e) => {
              // Delegate UI while loading the app
              let result = await Root.Libs.Modal.Show({
                parent: wrapper,
                pid: Root.Pid,
                title: langManager.getString(
                  "settings.categories.setup.items.deleteTitle",
                ),
                description: langManager.getString(
                  "settings.categories.setup.items.deleteDescription",
                ),
                buttons: [
                  {
                    type: "primary",
                    text: "No",
                  },
                  {
                    type: "negative",
                    text: "Yes",
                  },
                ],
              });

              if (result.id === 1) {
                await window.localforage.setItem("fs", null);
                location.reload();
              }
            }),
        );
        ui.add(row0.elm.children);
      },
      Input: async (wrapper, ui) => {
        wrapper.styleJs({
          padding: "20px",
        });
        new Html("h1")
          .text(langManager.getString("settings.categories.input.title"))
          .appendTo(wrapper);
        new Html("p")
          .text(langManager.getString("settings.categories.input.description"))
          .appendTo(wrapper);
        new Html("br").appendTo(wrapper);

        let phoneLinkStatus = new Html("p")
          .html(
            langManager.getString(
              "settings.categories.input.items.phoneLinkCode",
            ),
          )
          .append(new Html("strong").text(window.phoneLinkCode))
          .appendTo(wrapper);

        new Html("br").appendTo(wrapper);

        let qr = new Html("img")
          .styleJs({
            borderRadius: "5px",
            width: "20%",
          })
          .appendTo(wrapper);

        new Html("br").appendTo(wrapper);

        function showTvLinkCode() {
          phoneLinkStatus.style({ display: "block" });
          qr.style({ display: "block" });

          phoneLinkStatus.elm.querySelector("strong").textContent =
            window.phoneLinkCode;

          fetch("http://localhost:9864/local_ip")
            .then((res) => res.text())
            .then((ip) => {
              qr.attr({
                src: `${location.protocol}//${location.hostname}:9864/qr?url=${location.protocol}//${ip}:${location.port}/link/index.html?code=${window.phoneLinkCode}`,
              });
            });
        }
        function hideTvLinkCode() {
          phoneLinkStatus.style({ display: "none" });
          qr.style({ display: "none" });
        }

        // events
        document.addEventListener("CherryTree.Input.EnableTvRemote", () => {
          showTvLinkCode();
        });
        document.addEventListener("CherryTree.Input.DisableTvRemote", () => {
          hideTvLinkCode();
        });

        if (
          (await window.localforage.getItem("settings__phoneLink")) === true
        ) {
          showTvLinkCode();
        } else {
          hideTvLinkCode();
        }

        const row1 = new Html("div").class("flex-list").appendTo(wrapper);

        row1.appendMany(
          new Html("button")
            .text(
              langManager.getString(
                "settings.categories.input.items.phoneLinkToggle",
              ),
            )
            .on("click", () => settingsLib.togglePhoneLink(Root.Pid, wrapper)),
        );
        ui.add(row1.elm.children);
      },
      Display: (wrapper, ui) => {
        wrapper.styleJs({
          padding: "20px",
        });
        new Html("h1")
          .text(langManager.getString("settings.categories.display.title"))
          .appendTo(wrapper);
        new Html("p")
          .text(
            langManager.getString("settings.categories.display.description"),
          )
          .appendTo(wrapper);
        new Html("br").appendTo(wrapper);

        const row2 = new Html("div").class("flex-list").appendTo(wrapper);

        row2.appendMany(
          new Html("button")
            .text(
              langManager.getString(
                "settings.categories.display.items.uiScaling",
              ),
            )
            .on("click", () => settingsLib.uiScaling(Root.Pid, wrapper, Ui)),
          new Html("button")
            .text(
              langManager.getString(
                "settings.categories.display.items.background",
              ),
            )
            .on("click", () =>
              settingsLib.background(Root.Pid, wrapper, Background),
            ),
        );
        ui.add(row2.elm.children);
        new Html("br").appendTo(wrapper);
        new Html("h1")
          .text(
            langManager.getString(
              "settings.categories.pictureCalibration.title",
            ),
          )
          .appendTo(wrapper);
        new Html("br").appendTo(wrapper);
        const row4 = new Html("div").class("flex-list").appendTo(wrapper);

        row4.appendMany(
          new Html("button")
            .text(
              langManager.getString(
                "settings.categories.pictureCalibration.testPattern",
              ),
            )
            .on("click", async () => {
              await Root.Libs.startPkg(
                "apps:VideoPlayer",
                [
                  {
                    app: "video",
                    videoPath: "../../assets/video/color_bars.mp4",
                    displayName: langManager.getString(
                      "settings.categories.pictureCalibration.testPatternName",
                    ),
                    isOnline: true,
                    autoplay: false,
                  },
                ],
                true,
              );
            }),
        );
        ui.add(row4.elm.children);
      },
      Audio: (wrapper, ui) => {
        wrapper.styleJs({
          padding: "20px",
        });
        new Html("h1")
          .text(langManager.getString("settings.categories.audio.title"))
          .appendTo(wrapper);
        new Html("p")
          .text(langManager.getString("settings.categories.audio.description"))
          .appendTo(wrapper);

        new Html("br").appendTo(wrapper);
        const row3 = new Html("div").class("flex-list").appendTo(wrapper);

        row3.appendMany(
          new Html("button")
            .text(
              langManager.getString("settings.categories.audio.items.volume"),
            )
            .on("click", () =>
              settingsLib.changeVolume(Root.Pid, wrapper, Sfx),
            ),
          new Html("button")
            .text(langManager.getString("settings.categories.audio.items.sfx"))
            .on("click", () => settingsLib.sfx(Root.Pid, wrapper, Sfx)),
          new Html("button")
            .text(langManager.getString("settings.categories.audio.items.bgm"))
            .on("click", () => settingsLib.bgm(Root.Pid, wrapper, Sfx)),
        );
        ui.add(row3.elm.children);
      },
      Comms: (wrapper, ui) => {
        wrapper.styleJs({
          padding: "20px",
        });
        new Html("h1")
          .text(langManager.getString("settings.categories.comms.title"))
          .appendTo(wrapper);
        new Html("p")
          .text(langManager.getString("settings.categories.comms.description"))
          .appendTo(wrapper);

        new Html("br").appendTo(wrapper);
        const row = new Html("div").class("flex-list").appendTo(wrapper);

        row.appendMany(
          new Html("button")
            .text(
              langManager.getString("settings.categories.comms.items.audio"),
            )
            .on("click", () =>
              settingsLib.audioInputSelection(Root.Pid, wrapper),
            ),
          new Html("button")
            .text(
              langManager.getString("settings.categories.comms.items.video"),
            )
            .on("click", () =>
              settingsLib.videoInputSelection(Root.Pid, wrapper),
            ),
          new Html("button")
            .text(langManager.getString("settings.categories.comms.items.test"))
            .on("click", () => console.log("not implemented")),
        );
        ui.add(row.elm.children);
      },
    };
    this.tabbedUi = new TabbedUI({
      pid: Pid,
      tabs: tabs,
      wrapper: wrapper,
      ui: Ui,
      sfx: Sfx,
      callback: (e) => {
        if (e == "back") {
          pkg.end();
        }
      },
    });
  },
  end: async function () {
    // Exit this UI when the process is exited
    this.tabbedUi.cleanup();
    Ui.cleanup(Pid);
    Sfx.playSfx("deck_ui_out_of_game_detail.wav");
    // await Ui.transition("popOut", wrapper);
    Ui.giveUpUi(Pid);
    wrapper.cleanup();
  },
};

export default pkg;
