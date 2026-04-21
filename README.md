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

The server will start at `http://localhost:5000`. Make sure the mobile app is pointing to this address when testing locally.

## Running the Flask server on GCP VM

SSH into the GCP VM instance, then:

```
cd server
source venv/bin/activate
python app.py
```

The server will be accessible at `http://<GCP_EXTERNAL_IP>:5000`. Replace `<GCP_EXTERNAL_IP>` with the actual external IP address of the VM instance. Make sure port 5000 is open in the GCP firewall rules.
