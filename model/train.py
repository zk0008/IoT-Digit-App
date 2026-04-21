import tensorflow as tf
from tensorflow.keras import layers, models

# load MNIST - images of handwritten digits 0-9
(x_train, y_train), (x_test, y_test) = tf.keras.datasets.mnist.load_data()

# normalise pixel values from 0-255 to 0-1
x_train = x_train / 255.0
x_test = x_test / 255.0

# CNN expects shape (batch, height, width, channels), so add a channel dimension
x_train = x_train[..., tf.newaxis]
x_test = x_test[..., tf.newaxis]

# build the CNN
model = models.Sequential([
    # first conv layer - learns basic features like edges
    layers.Conv2D(32, (3, 3), activation='relu', input_shape=(28, 28, 1)),
    layers.MaxPooling2D((2, 2)),

    # second conv layer - learns more complex patterns
    layers.Conv2D(64, (3, 3), activation='relu'),
    layers.MaxPooling2D((2, 2)),

    # flatten and output one score per digit class
    layers.Flatten(),
    layers.Dense(10, activation='softmax')
])

model.compile(optimizer='adam',
              loss='sparse_categorical_crossentropy',
              metrics=['accuracy'])

# train for 5 epochs
model.fit(x_train, y_train, epochs=5)

# print final test accuracy
_, test_acc = model.evaluate(x_test, y_test)
print(f"Test accuracy: {test_acc:.4f}")

# save the trained weights
model.save_weights("model.weights.h5")
print("Model weights saved to model.weights.h5")
