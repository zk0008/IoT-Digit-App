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
    # decode base64 and open as grayscale image
    img_bytes = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(img_bytes)).convert("L")

    # normalise to 0-1
    arr = np.array(img) / 255.0

    # find rows and columns that have any drawn pixel above threshold
    rows = np.where(arr.max(axis=1) > 0.1)[0]
    cols = np.where(arr.max(axis=0) > 0.1)[0]

    # if nothing was drawn, return a blank input
    if len(rows) == 0 or len(cols) == 0:
        return np.zeros((1, 28, 28, 1))

    # crop to just the bounding box of the drawn content
    crop = arr[rows[0]:rows[-1]+1, cols[0]:cols[-1]+1]

    # add 10% padding around the crop on all sides
    h, w = crop.shape
    pad_h = max(1, int(h * 0.1))
    pad_w = max(1, int(w * 0.1))
    padded = np.pad(crop, ((pad_h, pad_h), (pad_w, pad_w)), mode='constant', constant_values=0)

    # resize padded crop to 28x28 using PIL
    padded_img = Image.fromarray((padded * 255).astype(np.uint8))
    resized = padded_img.resize((28, 28), Image.LANCZOS)

    # reshape to match model input format
    result = np.array(resized) / 255.0
    result = result.reshape(1, 28, 28, 1)
    return result

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    arr = preprocess_image(data["image"])
    probs = model.predict(arr)[0]  # softmax output for all 10 classes
    prediction = int(np.argmax(probs))
    confidence = round(float(probs[prediction]) * 100, 1)
    return jsonify({"prediction": prediction, "confidence": confidence})

@app.route("/retrain", methods=["POST"])
def retrain():
    data = request.get_json()
    arr = preprocess_image(data["image"])
    label = tf.keras.utils.to_categorical([int(data["label"])], num_classes=10)
    # recompile with a tiny learning rate so we nudge the model without overwriting what it learned
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
                  loss='categorical_crossentropy',
                  metrics=['accuracy'])
    model.fit(arr, label, epochs=1, verbose=0)
    # save updated weights back to the same file
    model.save_weights("model.weights.h5")
    return jsonify({"message": "Model updated and saved"})

if __name__ == "__main__":
    # threaded=True lets Flask handle multiple requests at the same time
    app.run(host="0.0.0.0", port=5000, threaded=True)
