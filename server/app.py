import base64
import io
import numpy as np
from flask import Flask, jsonify, request
from PIL import Image
import tensorflow as tf

app = Flask(__name__)

# define the same CNN architecture as in train.py
model = tf.keras.models.Sequential([
    tf.keras.layers.Conv2D(32, (3, 3), activation='relu', input_shape=(28, 28, 1)),
    tf.keras.layers.MaxPooling2D((2, 2)),
    tf.keras.layers.Conv2D(64, (3, 3), activation='relu'),
    tf.keras.layers.MaxPooling2D((2, 2)),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(10, activation='softmax')
])
model.compile(optimizer='adam',
              loss='categorical_crossentropy',
              metrics=['accuracy'])
# load the trained weights
model.load_weights("model.weights.h5")

def preprocess_image(b64_string):
    # decode base64 to bytes, open as image, convert to grayscale 28x28
    img_bytes = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(img_bytes)).convert("L").resize((28, 28))
    # turn into numpy array, normalise to 0-1, reshape to match model input
    arr = np.array(img) / 255.0
    arr = arr.reshape(1, 28, 28, 1)
    return arr

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    arr = preprocess_image(data["image"])
    # run inference and pick the class with the highest score
    prediction = int(np.argmax(model.predict(arr), axis=1)[0])
    return jsonify({"prediction": prediction})

@app.route("/retrain", methods=["POST"])
def retrain():
    data = request.get_json()
    arr = preprocess_image(data["image"])
    label = tf.keras.utils.to_categorical([int(data["label"])], num_classes=10)
    # do one training step on this single sample
    model.fit(arr, label, epochs=1, verbose=0)
    # save updated weights back to the same file
    model.save_weights("model.weights.h5")
    return jsonify({"message": "Model updated and saved"})

if __name__ == "__main__":
    # threaded=True lets Flask handle multiple requests at the same time
    app.run(host="0.0.0.0", port=5000, threaded=True)
