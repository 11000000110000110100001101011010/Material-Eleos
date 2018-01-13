// @flow
/*jshint esversion: 6 */
/*jslint node: true */
"use strict";

const electron = require("electron");
const {app, dialog, ipcMain, Menu} = require("electron");
const BrowserWindow = electron.BrowserWindow;
const path = require("path");
const url = require("url");
const os = require("os");
const fs = require("fs");
const spawn = require("child_process").spawn;
const execFile = require("child_process").execFile ;
const tcpPortUsed = require("tcp-port-used");
const tar = require("tar-fs");

const crypto = require("crypto");
const request = require("request");
const progress = require("request-progress");

let initWalletCount = 0;
let config;
let wallet;
let mainWindow;
let zcashd;
let downloadProgress = {};
let paramsPending = false;
let keyVerification = {
    proving: false,
    provingDownloading: false,
    verifying: false,
    verifyingDownloading: false
};
let configComplete = false;
let data;

function getFileHash(path, callback) {
    const hash = crypto.createHash("sha256");
    let input;
    if (fs.existsSync(path)) {
        input = fs.createReadStream(path);
    }
    else {
        return callback(false);
    }
    input.on("readable", function () {
        const d = input.read();
        if (d) {
            hash.update(d);
        }
        else {
            callback(hash.digest("hex"));
        }
    });
}

function fileDownload(url, path, callback) {
    if (paramsPending === true) {
        return;
    }

    progress(request(url), {
        // throttle: 2000,                    // Throttle the progress event to 2000ms, defaults to 1000ms
        // delay: 1000,                       // Only start to emit after 1000ms delay, defaults to 0ms
        // lengthHeader: 'x-transfer-length'  // Length header to use, defaults to content-length
    })
        .on("progress", function (state) {
            paramsPending = true;
            downloadProgress.name = url;
            downloadProgress.percent = state.percent;
            downloadProgress.timeRemaining = state.time.remaining;
        })
        .on("error", function (err) {
            dialog.showErrorBox("Error downloading file", "There was an error trying to download " + downloadProgress.name);
            console.log(err);
        })
        .on("end", function () {
            paramsPending = false;
            if (typeof callback === "function") {
                callback();
            }
        })
        .pipe(fs.createWriteStream(path));
}

function writeConfig(data) {
    fs.writeFileSync((app.getPath("userData") + "/config.json"), data);
}

function getUserDataDir() {
    return app.getPath("userData");
}

function clearConfig(callback) {
    data = {
        "coin": "zcl",
        "rpcUser": "",
        "rpcPass": "",
        "rpcIP": "127.0.0.1",
        "rpcPort": "",
        "binaryPathWin": "",
        "binaryPathMacOS": "",
        "binaryPathLinux": "",
        "confPathWin": "",
        "confPathMacOS": "",
        "confPathLinux": ""
    };
    data = JSON.stringify(data, null, 4);
    fs.writeFileSync((app.getPath("userData") + "/config.json"), data);
    config = require(app.getPath("userData") + "/config.json");
    //dialog.showErrorBox("Configuration options reset", "Configuration file reset.");
    if (typeof callback === "function") {
        callback();
    }
}

function checkCoinConfig(callback) {
    // return if config not yet initialized
    if (!config || !config.coin) {
        return;
    }

    // generic locations for zclassic, zcash, and zencash
    let zclPath, zecPath, zenPath;
    if ((os.platform() === "win32") || (os.platform() === "darwin")) {
        zclPath = "/Zclassic";
    }
    else {
        zclPath = "/.zclassic";
    }

    // check if coin configuration files exist and if not write them
    if ((config.coin.toLowerCase() === "zcl") && (!fs.existsSync(app.getPath("appData") + zclPath + "/zclassic.conf"))) {
        if (!fs.existsSync(app.getPath("appData") + zclPath)) {
            fs.mkdirSync(app.getPath("appData") + zclPath);
        }
        let data = [
            "rpcuser=zclrpc",
            "rpcpassword=" + crypto.randomBytes(8).toString("hex"),
            "rpcport=8232",
			"addnode=zec.suprnova.cc",
			"addnode=dnsseed.zclassic.org",
			"addnode=50.112.137.36",
			"addnode=188.166.136.203",
			"addnode=159.89.198.93",
			"addnode=64.69.86.213",
			"addnode=67.183.29.123",
			"addnode=149.56.129.104",
			"addnode=51.254.132.145",
			"addnode=139.99.100.70",
			"addnode=na1.zclassic.org",
			"addnode=eu1.zclassic.org",
			"addnode=as1.zclassic.org",
        ];
        fs.writeFileSync(app.getPath("appData") + zclPath + "/zclassic.conf", data.join("\n"));
    }

    if (typeof callback === "function") {
        callback();
    }
}

function checkConfig(callback) {
    // return if both eleos and coins are configured
    if (configComplete === true) {
        return;
    }

    // if config.json doesn"t exist then create a generic one
    if (!fs.existsSync(app.getPath("userData") + "/config.json")) {
        clearConfig(function () {
            checkCoinConfig(function () {
                configComplete = true;
                checkParams();
                if (typeof callback === "function") {
                    callback();
                }
            });
        });
    }
    else {
        config = require(app.getPath("userData") + "/config.json");
        checkCoinConfig(function () {
            configComplete = true;
            checkParams();
            if (typeof callback === "function") {
                callback();
            }
        });
    }
}

function checkParams() {
    if (keyVerification.verifying === true || keyVerification.proving === true ||
        paramsPending === true || keyVerification.verifyingDownloading === true ||
        keyVerification.provingDownloading === true) {
        return;
    }
    if (!fs.existsSync(app.getPath("appData") + "/ZcashParams/")) {
        fs.mkdirSync(app.getPath("appData") + "/ZcashParams/");
    }
    getFileHash(app.getPath("appData") + "/ZcashParams/sprout-verifying.key", function (result) {
        if (result === "4bd498dae0aacfd8e98dc306338d017d9c08dd0918ead18172bd0aec2fc5df82") {
            keyVerification.verifying = true;
        }
        else {
            keyVerification.verifyingDownloading = true;
            fileDownload("https://z.cash/downloads/sprout-verifying.key", app.getPath("appData") + "/ZcashParams/sprout-verifying.key",
                function () {
                    keyVerification.verifying = true;
                    keyVerification.verifyingDownloading = false;
                });
        }
    });
    getFileHash(app.getPath("appData") + "/ZcashParams/sprout-proving.key", function (result) {
        if (result === "8bc20a7f013b2b58970cddd2e7ea028975c88ae7ceb9259a5344a16bc2c0eef7") {
            keyVerification.proving = true;
        }
        else {
            keyVerification.provingDownloading = true;
            fileDownload("https://z.cash/downloads/sprout-proving.key", app.getPath("appData") + "/ZcashParams/sprout-proving.key",
                function () {
                    keyVerification.proving = true;
                    keyVerification.provingDownloading = false;
                });
        }
    });
}

function startWallet() {
    let cmd;

    // if we are configured for zcl then do zcl stuff bro
    if (config.coin.toLowerCase() === "zcl" || config.coin.toLowerCase() === "") {
        if (os.platform() === "win32") {
            cmd = config.binaryPathWin.length > 0 ? config.binaryPathWin : (app.getAppPath() + "/zcld.exe");
        }
        else if (os.platform() === "darwin") {
            cmd = config.binaryPathMacOS.length > 0 ? config.binaryPathMacOS : (app.getAppPath() + "/zcld-mac");
        }
        else if (os.platform() === "linux") {
            cmd = config.binaryPathLinux.length > 0 ? config.binaryPathLinux : (app.getAppPath() + "/zcld-linux");
        }
    }


    // check if wallet binary exists first
    if (!fs.existsSync(cmd)) {
        dialog.showErrorBox("Could not find wallet daemon", "Double-check the configuration settings.");
        app.exit(1);
    }
    else {
        if(initWalletCount === 10){
            dialog.showErrorBox("Wallet daemon can not be run.", "Check if daemon does not run already.");
            app.exit(1);
        }
        initWalletCount++;
        if (!zcashd && (keyVerification.verifying === true && keyVerification.proving === true && configComplete === true)) {
            try {
                zcashd = spawn(cmd);
            }
            catch (err) {
                dialog.showErrorBox("Could not start wallet daemon", "Double-check the configuration settings.");
            }
        }
    }
}

function getFileLocationOpts(title) {
    let options = {};
    options.title = title;
    options.defaultPath = require("path").dirname(require.main.filename);
    options.properties = ["showHiddenFiles", "openFile"];
    options.filters = [
        {name: "Executables", extensions: ["*"]}
    ];
    return options;
}

function getSaveLocationOpts(title, filename) {
    let options = {};
    options.title = title;
    options.defaultPath = app.getPath("home") + "/" + filename;
    options.properties = ["showHiddenFiles", "openFile"];
    return options;
}

function binaryPathCB(path) {
    if (!path || !path[0]) {
        return;
    }
    path = path[0];
    console.log("Setting binary path to: " + path);
    if (os.platform() === "win32") {
        config.binaryPathWin = path;
    }
    else if (os.platform() === "darwin") {
        config.binaryPathMacOS = path;
    }
    else if (os.platform() === "linux") {
        config.binaryPathLinux = path;
    }
    writeConfig(JSON.stringify(config, null, 4));
}

function confPathCB(path) {
    if (!path || !path[0]) {
        return;
    }
    path = path[0];
    console.log("Setting coin configuration path to: " + path);
    if (os.platform() === "win32") {
        config.confPathWin = path;
    }
    else if (os.platform() === "darwin") {
        config.confPathMacOS = path;
    }
    else if (os.platform() === "linux") {
        config.confPathLinux = path;
    }
    writeConfig(JSON.stringify(config, null, 4));
}

function createWindow() {
    if (configComplete === false) {
        checkConfig(createWindow);
        return;
    }
    wallet = require("./wallet.js");
    const template = [
        {
            label: "File",
            submenu: [
                {
                    label: "Import All Wallets (from .tar file)",
                    click() {
                        dialog.showOpenDialog(getFileLocationOpts("Import eleos-wallets.tar"), function (path) {
                            if (!path || !path[0]) {
                                return;
                            }

                            let tarball = fs.createReadStream(path[0]);

                            // get Zclassic path and backup current wallet
                            let zclPath;
                            if ((os.platform() === "win32") || (os.platform() === "darwin")) {
                                zclPath = app.getPath("appData") + "/" + "Zclassic/wallet.dat";
                            }
                            if (os.platform() === "linux") {
                                zclPath = app.getPath("home") + "/" + "./zclassic/wallet.dat";
                            }
                            if (fs.existsSync(zclPath)) {
                                let newPath = zclPath + ".bak-" + new Date().getTime();
                                fs.createReadStream(zclPath).pipe(fs.createWriteStream(newPath));
                            }

                            let extractDir;
                            if (os.platform() === "win32") {
                                extractDir = "";
                            }
                            else {
                                extractDir = "/";
                            }
                            tarball.pipe(tar.extract(extractDir, {
                                map: function (header) {
                                    if (header.name.toLowerCase().search("zcl") !== -1) {
                                        header.name = zclPath;
                                    }
                                    return header;
                                }
                            }));

                            dialog.showMessageBox(null, {
                                type: "info",
                                title: "Import complete.",
                                message: "Press ok to restart wallet."
                            });

                            app.relaunch({args: process.argv.slice(1).concat(['--relaunch'])});
                            app.exit(0);
                        });
                    }
                },
                {
                    label: "Backup All Wallets (to .tar file)",
                    click() {
                        dialog.showSaveDialog(getSaveLocationOpts("Save wallets", "wallets.tar"), function (path) {
                                if (!path || !path[0]) {
                                    return;
                                }

                                let tarball = fs.createWriteStream(path);
                                let entries = [];

                                // get Zclassic path
                                let zclPath;
                                if ((os.platform() === "win32") || (os.platform() === "darwin")) {
                                    zclPath = app.getPath("appData") + "/" + "Zclassic/wallet.dat";
                                }
                                if (os.platform() === "linux") {
                                    zclPath = app.getPath("home") + "/" + "./zclassic/wallet.dat";
                                }
                                if (fs.existsSync(zclPath)) {
                                    entries.push(zclPath);
                                }

                                // save renamed wallet.dat files into tarball
                                let packDir;
                                if (os.platform() === "win32") {
                                    packDir = "";
                                }
                                else {
                                    packDir = "/";
                                }
                                tar.pack(packDir, {
                                    entries: entries,
                                    map: function (header) {
                                        if (header.name.toLowerCase().search("zclassic") !== -1) {
                                            header.name = "./zcl-wallet.dat";
                                        }
                                        return header;
                                    }
                                }).pipe(tarball);
                            }
                        );
                    }
                }
            ]
        },
        {
            label: "Edit",
            submenu: [
                {label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:"},
                {label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:"},
                {type: "separator"},
                {label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:"},
                {label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:"},
                {label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:"},
                {label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:"}
            ]
        },
        {
            label: "Options",
            submenu: [
                {
                    label: "Set Wallet Daemon",
                    click() {
                        dialog.showOpenDialog(getFileLocationOpts("Set Wallet Daemon Location"), binaryPathCB);
                    }
                },
                {
                    label: "Set Coin Config Location",
                    click() {
                        dialog.showOpenDialog(getFileLocationOpts("Set Coin Config Location"), confPathCB);
                    }
                },
                {
                    label: "separator",
                    type: "separator"
                },
                {
                    label: "Reset Configuration",
                    click() {
                        clearConfig();
                    }
                },
                {
                    label: "separator",
                    type: "separator"
                },
                {
                    label: "Show version",
                    click() {
                        let pjs = require("./package.json");
                        console.log("Version: " + pjs.version);
                        dialog.showMessageBox(null, {
                            type: "info",
                            title: "Material Eleos",
                            message: "Version: " + pjs.version
                        });
                    }
                }
            ]
        }
    ];

    if (os.platform() === "darwin") {
        template.unshift({
            label: app.getName(),
            submenu: [
                {
                    role: "about"
                },
                {
                    type: "separator"
                },
                {
                    role: "services",
                    submenu: []
                },
                {
                    type: "separator"
                },
                {
                    role: "hide"
                },
                {
                    role: "hideothers"
                },
                {
                    role: "unhide"
                },
                {
                    type: "separator"
                },
                {
                    role: "quit"
                }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    mainWindow = new BrowserWindow({
        "minWidth": 1350,
        "minHeight": 800,
        "width": 1350,
        "height": 800,
        icon: "resources/" + config.coin.toLowerCase() + ".png"
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file:",
        slashes: true
    }));
	
    mainWindow.webContents.openDevTools();

    mainWindow.on("closed", function () {
        mainWindow = null;
    });
}

app.on("ready", function () {
    checkConfig(createWindow);
});

app.on("window-all-closed", function () {
    if (process.platform !== "darwin") {
        app.exit(0);
    }
});

app.on("activate", function () {
    if (mainWindow === null) {
        checkConfig(createWindow);
    }
});

app.on("before-quit", function () {
    if (zcashd) {
        console.log("Sending wallet STOP command.");
        wallet.jsonQuery({"jsonrpc": "1.0", "id": "stop", "method": "stop", "params": []},
            function (text) {
                console.log(text.result);
            });
    }
});


ipcMain.on("check-config", function () {
    checkConfig();
});

ipcMain.on("check-params", (event) => {
    if ((keyVerification.verifying === false || keyVerification.proving === false)) {
        checkParams();
    }
    if (keyVerification.verifyingDownloading === true || keyVerification.provingDownloading === true) {
        event.sender.send("params-pending", downloadProgress);
    } else {
        // check if rpcIP and rpcPort are already running
        tcpPortUsed.check(parseInt(wallet.getCredentials().rpcPort), wallet.getCredentials().rpcIP)
            .then(function (inUse) {
                if (inUse) {
                    zcashd = true;
                }
                if (!inUse) {
                    zcashd = false;
                }
            }, function (err) {
                console.log("error polling rpc port");
                console.log(err);
                zcashd = false;
            });
        event.sender.send("params-complete", Boolean(zcashd));
    }
});

ipcMain.on("check-wallet", function () {
    if (!zcashd && (keyVerification.verifying === true && keyVerification.proving === true)) {
        startWallet();
    }
});

ipcMain.on("save-opts", (event, opts) => {
    for (let i = 0; i < Object.keys(opts).length; i++) {
        let key = Object.keys(opts)[i];
        config[key] = opts[key];
    }
    writeConfig(JSON.stringify(config, null, 4));
});

function getConfig() {
    return config;
}

module.exports = {getUserDataDir, getConfig};
