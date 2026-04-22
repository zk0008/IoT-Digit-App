# IoT-Digit-App

This app is a data entry tool designed for classified facility use. The idea is simple: instead of typing numbers manually, a user writes a digit on their phone screen and the app recognises it using a CNN model and submits it. It is meant to be a clean, low-friction way to log numeric data in the field.

## What it does

The mobile app collects handwritten digit input through a touchscreen canvas. Each digit the user draws is sent to the cloud server for inference, and the predicted digit gets appended to an editable text field in real time. A confidence score is shown for each prediction so the user knows how certain the model is.

If the model gets a digit wrong, the user can edit the text field to correct it and tap Submit. This sends the corrected digits along with their original drawings back to the server for incremental retraining, so the model learns from the correction. A retrain log below the text field shows which digits were corrected and retrained in that session.

A server status indicator at the top of the screen shows whether the app is currently connected to the cloud server. The Clear button wipes the canvas only, while Clear All resets the canvas, the text field, and the retrain log.

The server runs in threaded mode so multiple devices can connect and send requests at the same time without blocking each other.

## Tech stack

| Component | Technology | Details |
|---|---|---|
| Frontend | Expo React Native | iOS and Android |
| Backend | Python Flask | REST API server |
| Model | CNN trained on MNIST | Self-trained from scratch |
| Cloud | GCP e2-micro VM | Free tier, us-central1 |
| HTTP client | Axios | Mobile to server communication |

## Folder structure

```
IoT-Digit-App/
├── mobile/     - Expo React Native app
├── server/     - Flask backend and model weights
└── model/      - Training script and saved weights
```

## Requirements

- Python 3.11
- Node.js 18 or above
- Xcode (for iOS Simulator)

## Running the Expo app

Before running the app, create a file called `config.js` in the `mobile` folder with the following content:

```js
const SERVER_URL = "http://<your-gcp-external-ip>:5000";
export default SERVER_URL;
```

This file is gitignored and must be created manually on each machine you run the app from.

To run on an iOS Simulator, make sure Xcode is installed, then run:

```
cd mobile
npm install
npm run ios
```

To run on a physical iPhone, install the Expo Go app from the App Store, then run:

```
cd mobile
npm install
npx expo start
```

Scan the QR code shown in the terminal with the Camera app (or Expo Go directly) and it will open on your phone.

## Running the Flask server locally

```
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

The server will start at `http://127.0.0.1:5000`. Make sure the mobile app is pointing to this address when testing locally.

## Training the model

The training script is in the `model` folder. To retrain the model from scratch:

```
cd model
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python train.py
```

This downloads the MNIST dataset, trains the CNN for 5 epochs, prints the final test accuracy, and saves the weights to `model.weights.h5`. Copy the resulting `model.weights.h5` into the `server` folder before running the server.

## Deploying the Flask server on GCP VM

### Setup (run once)

```bash
# open GCP console, go to Compute Engine > VM Instances, click SSH next to your instance
sudo apt update                                    # update package list
sudo apt install python3-pip python3-venv git -y   # install required tools
git clone <your-repo-url>                          # clone the project
cd IoT-Digit-App/server                            # go to server folder
python3 -m venv venv                               # create virtual environment
source venv/bin/activate                           # activate virtual environment
sed -i 's/tensorflow-macos/tensorflow/g' requirements.txt  # swap mac-only package for linux version
sudo fallocate -l 2G /swapfile                     # create 2GB swap file
sudo chmod 600 /swapfile                           # set correct permissions
sudo mkswap /swapfile                              # format as swap
sudo swapon /swapfile                              # enable swap
pip install -r requirements.txt                    # install dependencies
```

Also open port 5000 in the GCP firewall: go to **VPC Network > Firewall**, create a rule to allow TCP port 5000 from `0.0.0.0/0`.

### Start the server

```bash
pgrep -f app.py                                    # check if server is already running
nohup python3 app.py > server.log 2>&1 &           # run server in background
```

### Check the server

```bash
curl http://127.0.0.1:5000/health                  # test locally on the VM
curl http://<your-gcp-external-ip>:5000/health     # test from outside the VM
```

### Update the server (when new changes are pushed to GitHub)

```bash
cd IoT-Digit-App                                   # go to project root
git pull                                           # pull latest changes
cd server                                          # go to server folder
source venv/bin/activate                           # reactivate venv
pkill -f app.py                                    # stop old server
nohup python3 app.py > server.log 2>&1 &           # restart with latest changes
```

### Stop the server

```bash
pkill -f app.py                                    # stop the server process
```

### Check logs

```bash
cat server.log                                     # view server output
```
