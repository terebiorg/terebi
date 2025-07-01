import vfs from "/libs/vfs.js";
import Html from "/libs/html.js";
import langManager from "../../libs/l10n/manager.js";
import settingsLib from "../../libs/settingsLib.js";

let Pid, Ui, wrapper, Sfx, cb;

const pkg = {
  name: "Oobe",
  type: "app",
  privs: 0,
  start: async function (Root) {
    console.log("Hi! From Oobe");
    console.log(vfs);

    window.desktopIntegration !== undefined &&
      window.desktopIntegration.ipc.send("setRPC", {
        details: "In the first-time setup",
      });

    if (Root.Arguments && Root.Arguments.length > 0) cb = Root.Arguments[0];

    Sfx = Root.Processes.getService("SfxLib").data;
    const UserSvc = Root.Processes.getService("UserSvc").data;
    const PartiesSvc = Root.Processes.getService("PartySvc").data;
    const Background = Root.Processes.getService("Background").data;
    Pid = Root.Pid;
    Ui = Root.Processes.getService("UiLib").data;

    // Your user token
    let token = "";

    // test!!!
    let isOnline = true;
    try {
      let tempResult = await fetch("https://tree.cherries.to/")
        .then((r) => r.text())
        .catch((e) => undefined);

      if (tempResult === undefined) throw new Error();
    } catch (e) {
      isOnline = false;
      window.isOffline = true;
      await Root.Libs.Modal.Show({
        parent: document.body,
        pid: Pid,
        title: langManager.getString("system.offline.title"),
        description: langManager.getString("system.offline.description"),
        buttons: [
          {
            type: "primary",
            text: langManager.getString("actions.ok"),
          },
        ],
      });
    }

    wrapper = new Html("div").class("full-ui").appendTo("body");

    let page = new Html("div").class("oobe-page").appendTo(wrapper);
    let bar = new Html("div").class("oobe-bar").appendTo(wrapper);

    let barLeft = new Html("div").class("left").appendTo(bar);
    let barRight = new Html("div").class("right").appendTo(bar);

    let svg = await (await fetch("/assets/img/oobe/welcome_row.svg")).text();

    const loadingPage = {
      elm: new Html("div")
        .class("flex-row", "oobe-spaced")
        .appendMany(
          new Html("div")
            .class("flex-col")
            .appendMany(
              new Html("h1").text(langManager.getString("status.checking")),
            ),
          new Html("div")
            .class("flex-col")
            .html(
              `<img style="width:4rem;height:4rem" class="loading" draggable="false" src="data:image/svg+xml,%3Csvg width='48' height='48' viewBox='0 0 48 48' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-path='url(%23clip0_1114_2788)'%3E%3Cpath d='M44.3563 24C46.3687 24 48.0283 22.3595 47.7239 20.3703C47.4328 18.4675 46.9131 16.6022 46.1731 14.8156C44.967 11.9038 43.1992 9.25804 40.9706 7.02944C38.742 4.80083 36.0962 3.033 33.1844 1.82689C30.2726 0.620778 27.1517 -1.37766e-07 24 0C20.8483 1.37766e-07 17.7274 0.620779 14.8156 1.82689C11.9038 3.033 9.25804 4.80083 7.02944 7.02944C4.80083 9.25804 3.033 11.9038 1.82689 14.8156C1.08686 16.6022 0.56719 18.4675 0.276061 20.3703C-0.0282817 22.3595 1.63132 24 3.64366 24C5.656 24 7.24768 22.3498 7.68294 20.3851C7.89306 19.4367 8.18597 18.5061 8.55949 17.6043C9.39938 15.5767 10.6304 13.7343 12.1823 12.1823C13.7343 10.6304 15.5767 9.39939 17.6043 8.55949C19.632 7.7196 21.8053 7.28732 24 7.28732C26.1947 7.28732 28.368 7.7196 30.3957 8.55949C32.4233 9.39939 34.2657 10.6304 35.8176 12.1823C37.3696 13.7343 38.6006 15.5767 39.4405 17.6043C39.814 18.5061 40.1069 19.4367 40.3171 20.3851C40.7523 22.3498 42.344 24 44.3563 24Z' fill='url(%23paint0_linear_1114_2788)'/%3E%3C/g%3E%3Cdefs%3E%3ClinearGradient id='paint0_linear_1114_2788' x1='0' y1='24' x2='48' y2='24' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-opacity='0'/%3E%3Cstop offset='1' stop-color='white'/%3E%3C/linearGradient%3E%3CclipPath id='clip0_1114_2788'%3E%3Crect width='48' height='48' fill='white'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E" />`,
            ),
        ),
      barButtons: {
        left: [],
        right: [],
      },
    };

    let pages = {
      loading: loadingPage,
    };

    await switchPage("loading", false);

    let ip;

    try {
      let a = await fetch("http://localhost:9864/local_ip").then((t) =>
        t.text(),
      );
      ip = a;
    } catch (e) {
      ip = "127.0.0.1";
    }

    let textData = {};

    async function promptForInput(
      title,
      description,
      parent,
      isPassword = false,
      resultName,
    ) {
      let options = {
        title,
        description,
        parent: document.body,
        pid: Root.Pid,
        value: parent.dataset.realText || "",
        type: isPassword === true ? "password" : "text",
      };

      let result = await Root.Libs.Modal.showKeyboard(options);

      if (result.canceled === true) return;

      parent.dataset.realText = result.value;
      if (isPassword === true) {
        parent.textContent = "•".repeat(result.value.length);
      } else parent.textContent = result.value;
      textData[resultName] = result.value;
    }

    let introWelcomeDiv = new Html("div")
      .style({
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
      })
      .html(svg);

    let toBeLocalized = introWelcomeDiv.elm.querySelectorAll("[data-localize]");
    for (const elm of toBeLocalized) {
      elm.textContent = langManager.getString(elm.dataset.localize);
    }

    pages = {
      welcome: {
        // Main parent element on top
        elm: new Html("div").class("flex-row").appendMany(introWelcomeDiv),
        // bottom bar buttons
        barButtons: {
          // Buttons call a page
          left: [],
          right: [
            {
              text: langManager.getString("system.oobe.getStarted"),
              goto: "phoneLinkSetup",
            },
          ],
        },
      },
      phoneLinkSetup: {
        // Main parent element on top
        elm: new Html("div").class("flex-list", "oobe-spaced").appendMany(
          new Html("div").class("flex-col").appendMany(
            new Html("h1").text(
              langManager.getString("system.oobe.phoneLink.title"),
            ),
            new Html("p").text(
              langManager.getString("system.oobe.phoneLink.description"),
            ),
            new Html("div").class("button-row").appendMany(
              new Html("button")
                .text(langManager.getString("label.help"))
                .on("click", async (e) => {
                  Root.Libs.Modal.Show({
                    title: langManager.getString(
                      "system.oobe.phoneLink.helpText",
                    ),
                    description: langManager.getString(
                      "system.oobe.phoneLink.helpInfo",
                      {
                        url: `${location.protocol}//${ip}:${location.port}/link`,
                      },
                    ),
                    parent: document.body,
                    pid: Root.Pid,
                    buttons: [
                      {
                        type: "primary",
                        text: langManager.getString("actions.ok"),
                      },
                    ],
                  });
                }),
            ),
          ),
          new Html("div").class("flex-col").appendMany(
            new Html("img")
              .attr({
                src: `http://127.0.0.1:9864/qr?url=${location.protocol}//${ip}:${location.port}/link/index.html?code=${window.phoneLinkCode}`,

                // src: `${location.protocol}//${location.hostname}:9864/qr?url=${location.protocol}//${ip}:${location.port}/link/index.html?code=${window.phoneLinkCode}`,
              })
              .styleJs({
                borderRadius: "0.5rem",
                width: "16rem",
                height: "16rem",
                imageRendering: "pixelated",
              }),
          ),
        ),
        // bottom bar buttons
        barButtons: {
          // Buttons call a page
          left: [
            { text: langManager.getString("actions.back"), goto: "welcome" },
          ],
          right: [
            {
              text: langManager.getString("actions.next"),
              goto: "configuration",
            },
          ],
        },
      },
      // controllerHelp: {
      //   // Main parent element on top
      //   elm: new Html("div")
      //     .class("flex-col")
      //     .appendMany(
      //       new Html("h1").text("Controller Help"),
      //       new Html("p").text(
      //         "Your controller may not be supported by the app."
      //       ),
      //       new Html("p").text("Officially supported controllers:"),
      //       new Html("ul").appendMany(
      //         new Html("li").text("Xbox 360, One, and Series S/X"),
      //         new Html("li").text("DualShock 3, 4, and DualSense"),
      //         new Html("li").text("Nintendo Switch Pro Controller"),
      //         new Html("li").text(
      //           "Any Bluetooth or USB-compatible Xinput gamepad (depends on your system)"
      //         )
      //       )
      //     ),
      //   // bottom bar buttons
      //   barButtons: {
      //     // Buttons call a page
      //     left: [{ text: "Back", goto: "phoneLinkSetup" }],
      //   },
      // },
      configuration: {
        // Main parent element on top
        elm: new Html("div").class("flex-row", "oobe-spaced").appendMany(
          new Html("div").class("flex-col").appendMany(
            new Html("h1").text("Configuration"),
            new Html("p").html(
              "Modify some settings before you get into the app.",
            ),
            new Html("div").class("button-row", "flex-list").appendMany(
              new Html("button")
                .text(
                  langManager.getString("settings.categories.display.title"),
                )
                .on("click", async () => {
                  let result = await Root.Libs.Modal.Show({
                    parent: wrapper,
                    pid: Root.Pid,
                    title: langManager.getString(
                      "settings.categories.display.title",
                    ),
                    description: langManager.getString(
                      "settings.categories.display.description",
                    ),
                    buttons: [
                      {
                        type: "primary",
                        text: langManager.getString(
                          "settings.categories.display.items.uiScaling",
                        ),
                      },
                      {
                        type: "primary",
                        text: langManager.getString(
                          "settings.categories.display.items.background",
                        ),
                      },
                    ],
                  });

                  if (result.canceled === true) return;

                  switch (result.id) {
                    case 0:
                      settingsLib.uiScaling(Root.Pid, wrapper, Ui);
                      break;
                    case 1:
                      settingsLib.background(Root.Pid, wrapper, Background);
                      break;
                  }
                }),
              new Html("button")
                .text(langManager.getString("settings.categories.audio.title"))
                .on("click", async () => {
                  let result = await Root.Libs.Modal.Show({
                    parent: wrapper,
                    pid: Root.Pid,
                    title: langManager.getString(
                      "settings.categories.audio.title",
                    ),
                    description: langManager.getString(
                      "settings.categories.audio.description",
                    ),
                    buttons: [
                      {
                        type: "primary",
                        text: langManager.getString(
                          "settings.categories.audio.items.volume",
                        ),
                      },
                      {
                        type: "primary",
                        text: langManager.getString(
                          "settings.categories.audio.items.sfx",
                        ),
                      },
                      {
                        type: "primary",
                        text: langManager.getString(
                          "settings.categories.audio.items.bgm",
                        ),
                      },
                    ],
                  });

                  if (result.canceled === true) return;

                  switch (result.id) {
                    case 0:
                      settingsLib.changeVolume(Root.Pid, wrapper, Sfx);
                      break;
                    case 1:
                      settingsLib.sfx(Root.Pid, wrapper, Sfx);
                      break;
                    case 2:
                      settingsLib.bgm(Root.Pid, wrapper, Sfx);
                      break;
                  }
                }),
            ),
            new Html("p").html("You can modify these later in Settings."),
          ),
        ),
        // bottom bar buttons
        barButtons: {
          // Buttons call a page
          left: [
            {
              text: langManager.getString("actions.back"),
              goto: "phoneLinkSetup",
            },
          ],
          right: [
            {
              text: langManager.getString("actions.next"),
              goto: "account",
            },
          ],
        },
      },
      account: {
        // Main parent element on top
        elm: new Html("div").class("flex-list", "oobe-spaced").appendMany(
          new Html("div")
            .class("flex-col")
            .appendMany(
              new Html("h1").text(
                langManager.getString("system.oobe.account.title"),
              ),
              new Html("p").text(
                langManager.getString("system.oobe.account.description"),
              ),
            ),
          new Html("div").class("flex-col").appendMany(
            new Html("div").class("button-row").appendMany(
              new Html("button")
                .text(langManager.getString("actions.login"))
                .on("click", (e) => {
                  switchPage("login");
                }),
            ),
            new Html("div").class("button-row").appendMany(
              new Html("button")
                .text(langManager.getString("actions.register"))
                .on("click", (e) => {
                  switchPage("register");
                }),
            ),
          ),
        ),
        // bottom bar buttons
        barButtons: {
          // Buttons call a page
          left: [
            {
              text: langManager.getString("actions.back"),
              goto: "configuration",
            },
          ],
          right: [
            {
              text: langManager.getString("actions.skip"),
              goto: async function () {
                let result = await Root.Libs.Modal.Show({
                  title: langManager.getString("system.oobe.modal.skip.title"),
                  description: langManager.getString(
                    "system.oobe.modal.skip.description",
                  ),
                  pid: Root.Pid,
                  parent: document.body,
                  buttons: [
                    {
                      type: "primary",
                      text: langManager.getString("actions.no"),
                    },
                    {
                      type: "primary",
                      text: langManager.getString("actions.yes"),
                    },
                  ],
                });

                if (result.canceled === true) return;

                if (result.id === 1) {
                  // set offline mode since no login
                  window.isOffline = true;
                  switchPage("thanks");
                }
              },
            },
          ],
        },
      },
      login: {
        // Main parent element on top
        elm: new Html("div").class("flex-row", "oobe-spaced").appendMany(
          new Html("div")
            .class("flex-col")
            .appendMany(
              new Html("h1").text(
                langManager.getString("system.oobe.login.title"),
              ),
              new Html("p").html(
                langManager.getString("system.oobe.login.description"),
              ),
            ),
          new Html("div").class("flex-col").appendMany(
            new Html("div").class("button-row", "flex-col").appendMany(
              new Html("span").text(
                langManager.getString("label.usernameOrEmail"),
              ),
              new Html("button").class("input-box").on("click", (e) => {
                promptForInput(
                  langManager.getString("system.oobe.modal.username.title"),
                  langManager.getString(
                    "system.oobe.modal.username.description",
                  ),
                  e.target,
                  false,
                  "login_username",
                );
              }),
            ),
            new Html("div").class("button-row", "flex-col").appendMany(
              new Html("span").text(langManager.getString("label.password")),
              new Html("button").class("input-box").on("click", (e) => {
                promptForInput(
                  langManager.getString("system.oobe.modal.password.title"),
                  langManager.getString(
                    "system.oobe.modal.password.description",
                  ),
                  e.target,
                  true,
                  "login_password",
                );
              }),
            ),
          ),
        ),
        // bottom bar buttons
        barButtons: {
          // Buttons call a page
          left: [{ text: "Back", goto: "account" }],
          right: [
            {
              text: "Next",
              goto: async function (e) {
                e.target.disabled = true;
                let result;
                try {
                  result = await UserSvc.login(
                    textData["login_username"],
                    textData["login_password"],
                  );

                  if (result.success === false) throw result; // trigger catch
                } catch (e) {
                  Root.Libs.Notify.show(
                    "Failed to login",
                    "Something went wrong: " + e.message,
                  );
                } finally {
                  e.target.disabled = false;
                }

                if (result.token !== undefined && result.success === true) {
                  token = result.token;

                  let checksComplete = 0;
                  function checks() {
                    if (checksComplete === 2) switchPage("thanks");
                  }

                  UserSvc.subscribe(token).then((ws) => {
                    Root.Security.setSecureVariable("CHERRY_TREE_WS", ws);
                    checksComplete++;
                    checks();
                  });
                  Root.Security.setToken(token).then((_) => {
                    checksComplete++;
                    checks();
                  });
                  PartiesSvc.subscribe(token);

                  return "loading";
                }
                return false;
              },
            },
          ],
        },
      },
      register: {
        // Main parent element on top
        elm: new Html("div").class("flex-row", "oobe-spaced").appendMany(
          new Html("div")
            .class("flex-col")
            .appendMany(
              new Html("h1").text(
                langManager.getString("system.oobe.register.title"),
              ),
              new Html("p").html(
                langManager.getString("system.oobe.register.description"),
              ),
            ),
          new Html("div").class("flex-col").appendMany(
            new Html("div").class("button-row", "flex-col").appendMany(
              new Html("span").text(langManager.getString("label.username")),
              new Html("button").class("input-box").on("click", (e) => {
                promptForInput(
                  langManager.getString("system.oobe.modal.username.title"),
                  langManager.getString(
                    "system.oobe.modal.username.description",
                  ),
                  e.target,
                  false,
                  "register_username",
                );
              }),
            ),
            new Html("div").class("button-row", "flex-col").appendMany(
              new Html("span").text(langManager.getString("label.email")),
              new Html("button").class("input-box").on("click", (e) => {
                promptForInput(
                  langManager.getString("system.oobe.modal.email.title"),
                  langManager.getString("system.oobe.modal.email.description"),
                  e.target,
                  false,
                  "register_email",
                );
              }),
            ),
            new Html("div").class("button-row", "flex-col").appendMany(
              new Html("span").text(langManager.getString("label.password")),
              new Html("button").class("input-box").on("click", (e) => {
                promptForInput(
                  langManager.getString("system.oobe.modal.password.title"),
                  langManager.getString(
                    "system.oobe.modal.password.description",
                  ),
                  e.target,
                  true,
                  "register_password",
                );
              }),
            ),
          ),
        ),
        // bottom bar buttons
        barButtons: {
          // Buttons call a page
          left: [
            { text: langManager.getString("actions.back"), goto: "account" },
          ],
          right: [
            {
              text: langManager.getString("actions.next"),
              goto: async function (e) {
                e.target.disabled = true;
                let result;
                try {
                  let result2 = await UserSvc.register(
                    textData["register_username"],
                    textData["register_password"],
                    textData["register_email"],
                  );
                  console.log(result2);

                  result = await UserSvc.login(
                    textData["register_username"],
                    textData["register_password"],
                  );
                  console.log(result);

                  if (result.success === false) throw result; // trigger catch
                } catch (e) {
                  Root.Libs.Notify.show(
                    "Failed to login",
                    "Something went wrong: " + e.message,
                  );
                } finally {
                  e.target.disabled = false;
                }

                if (result.token !== undefined && result.success === true) {
                  token = result.token;

                  let checksComplete = 0;
                  function checks() {
                    if (checksComplete === 2) switchPage("thanks");
                  }

                  UserSvc.subscribe(token).then((ws) => {
                    Root.Security.setSecureVariable("CHERRY_TREE_WS", ws);
                    checksComplete++;
                    checks();
                  });
                  Root.Security.setToken(token).then((_) => {
                    checksComplete++;
                    checks();
                  });

                  return "loading";
                }
                return false;
              },
            },
          ],
        },
      },
      thanks: {
        // Main parent element on top
        elm: new Html("div")
          .class("flex-row", "oobe-spaced")
          .appendMany(
            new Html("div")
              .class("flex-col")
              .appendMany(
                new Html("h1").text(
                  langManager.getString("system.oobe.thanks.title"),
                ),
                new Html("p").html(
                  langManager.getString("system.oobe.thanks.description"),
                ),
              ),
          ),
        // bottom bar buttons
        barButtons: {
          // Buttons call a page
          left: [],
          right: [
            {
              text: langManager.getString("actions.finish"),
              goto: async function () {
                Root.end();
                return true;
              },
            },
          ],
        },
      },
    };

    // skip phone setup if server isn't running
    if (ip === "127.0.0.1") {
      pages["welcome"].barButtons.right[0].goto = "configuration";
      pages["configuration"].barButtons.left[0].goto = "welcome";
      // pages["account"].barButtons.left[0].goto = "configuration";
    }
    // offline mode
    if (isOnline === false) {
      pages["configuration"].barButtons.right[0].goto = "thanks";
    }
    pages["loading"] = loadingPage;

    Object.keys(pages).forEach((k) => {
      pages[k].elm.classOn("oobe-page");
      pages[k].elm.class("oobe-page");
    });

    async function switchPage(name, setupUi = true) {
      if (pages[name] === undefined) return;
      page.html("");
      barLeft.html("");
      barRight.html("");
      pages[name].elm.appendTo(page);

      // Add the page's Buttons
      if (pages[name].barButtons.left !== undefined) {
        pages[name].barButtons.left.forEach((b) => {
          barLeft.append(
            new Html("button").text(b.text).on("click", async (e) => {
              if (typeof b.goto === "string") await switchPage(b.goto);
              else if (typeof b.goto === "function") {
                let result = await b.goto(e);
                if (result === false) return;
                if (typeof result === "string") await switchPage(result);
              }
            }),
          );
        });
      }
      if (pages[name].barButtons.right !== undefined) {
        pages[name].barButtons.right.forEach((b) => {
          barRight.append(
            new Html("button").text(b.text).on("click", async (e) => {
              if (typeof b.goto === "string") await switchPage(b.goto);
              else if (typeof b.goto === "function") {
                let result = await b.goto(e);
                if (result === false) return;
                if (typeof result === "string") await switchPage(result);
              }
            }),
          );
        });
      }

      if (setupUi === true) {
        let buttonRows = [[]];
        if (pages[name].elm.elm.querySelector(".button-row") !== undefined) {
          buttonRows = Array.from(
            pages[name].elm.elm.querySelectorAll(".button-row"),
          ).map((m) => {
            return m.children;
          });
        }

        Ui.updatePos(Root.Pid, { x: 0, y: 0 });
        Ui.update(Root.Pid, [
          ...buttonRows,
          Array.from(barLeft.elm.children).concat(
            Array.from(barRight.elm.children),
          ),
        ]);
        if (window.p !== 4) Ui.focus.focusCurrent(Root.Pid);
      }
      Sfx.playSfx("deck_ui_tab_transition_01.wav");
    }

    Ui.transition("popIn", wrapper);
    Ui.becomeTopUi(Root.Pid, wrapper);

    Ui.init(
      Root.Pid,
      "horizontal",
      [[], []],
      // function (e) {
      //   if (e === "menu" || e === "back") {
      //     pkg.end();
      //   }
      // }
    );
    await switchPage("welcome");

    // show modal here as previously the "checking" screen could be seen below it
    if (ip === "127.0.0.1") {
      await Root.Libs.Modal.Show({
        parent: document.body,
        pid: Pid,
        title: langManager.getString("system.noLocalServer.title"),
        description: langManager.getString("system.noLocalServer.description"),
        buttons: [
          {
            type: "primary",
            text: langManager.getString("actions.ok"),
          },
        ],
      });
    }
  },
  end: async function () {
    // Exit this UI when the process is exited
    Ui.cleanup(Pid);
    Sfx.playSfx("deck_ui_out_of_game_detail.wav");
    // await Ui.transition("popOut", wrapper);
    Ui.giveUpUi(Pid);
    wrapper.cleanup();

    if (cb) cb();
  },
};

export default pkg;
