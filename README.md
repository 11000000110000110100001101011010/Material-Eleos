# Zclassic electronjs wallet


Wallet for zero-knowledge cryptocurrencies for Windows, MacOS, and Linux (Supports Zclassic for now)

![Screenshot](https://user-images.githubusercontent.com/34781723/34685131-af5ec628-f4a7-11e7-806e-d2ab48b17e4e.png)

### Installation
Note: First time installations may take awhile to load since ~1GB of cryptographic data must be downloaded first.

##### Windows
The simplest way to get started on Windows (https://github.com/johandjoz/Material-Eleos/releases).


##### Linux and MacOS
Note: Requires that the compiled wallets are named zcld-linux or zcld-mac and are saved into the Zclassic electronjs wallet directory. Need electronjs packager for build.

Get the dependencies

Get the source
```
git clone https://github.com/johandjoz/Material-Eleos
```
cd ~/Builds/eleos
```
npm install 
```
Copy the Zclassic/Zcash wallet daemon into the elos directory (name the binary zcld-linux)
```
cp ~/Builds/zclassic/src/zcashd ~/Builds/eleos/zcld-linux
```
Start eleos
```
npm start
```


### wallet.dat


Eleos is primarily designed for Zcash-based cryptocurrencies. The wallet.dat for each cryptocurrency is stored in the directories below.

| Support | Status | Windows Location | MacOS Location |
| ------ | ------ | ------ | ------ |
| Zclassic | Fully supported | %APPDATA%/Zclassic | ~/Library/Application Support/Zclassic |


### Todos

 - design improvement


### License
Common Public Attribution License (CPAL-1.0)
Created by Josh Yabut for ZenCash
