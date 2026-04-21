# IoT-Digit-App

This app is a data entry tool designed for classified facility use. The idea is simple: instead of typing numbers manually, a user writes a digit on their phone screen and the app recognises it using a CNN model and submits it. It is meant to be a clean, low-friction way to log numeric data in the field.

## What it does

The mobile app lets a user draw a handwritten digit, sends it to a Flask backend, and gets back a prediction from a CNN trained on the MNIST dataset. The predicted digit can then be used as input for facility data logging.

## Tech stack

The frontend is built with Expo React Native, so it runs on both iOS and Android. The backend is a Python Flask server that handles prediction requests. The CNN model was trained from scratch on MNIST. In production, the Flask server runs on a GCP VM instance.

## Folder structure

The `mobile` folder contains the Expo React Native app. The `server` folder contains the Flask backend and prediction logic. The `model` folder contains the CNN training script and saved model weights.

## Running the Expo app

To run on an iOS Simulator, make sure Xcode is installed, then run:

```
cd mobile
npm run ios
```

To run on a physical iPhone, install the Expo Go app from the App Store, then run:

```
cd mobile
npx expo start
```

Scan the QR code shown in the terminal with the Camera app (or Expo Go directly) and it will open on your phone.

## Running the Flask server locally

```
cd server
source venv/bin/activate
python app.py
```

The server will start at `http://127.0.0.1:5000`. Make sure the mobile app is pointing to this address when testing locally.

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
