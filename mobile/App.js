import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import axios from 'axios';
import SERVER_URL from './config.js';

export default function App() {
  const sigRef = useRef(null);
  const strokeTimer = useRef(null); // timer to wait after last stroke

  const [isLoading, setIsLoading] = useState(false);
  const [predictedString, setPredictedString] = useState(''); // original server predictions
  const [editedString, setEditedString] = useState('');        // what user sees and edits
  const [capturedImages, setCapturedImages] = useState([]);    // one image per predicted digit
  const [successMessage, setSuccessMessage] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 }); // actual rendered size

  // user lifted pen - reset timer so we wait 0.8s after the last stroke
  const handleEnd = () => {
    if (strokeTimer.current) clearTimeout(strokeTimer.current);
    strokeTimer.current = setTimeout(() => {
      sigRef.current.readSignature(); // triggers onOK with the base64 image
    }, 800);
  };

  // called after readSignature() - signature is a full data URL
  const handleOK = async (signature) => {
    const base64 = signature.replace('data:image/png;base64,', '');

    setIsLoading(true);
    try {
      const response = await axios.post(`${SERVER_URL}/predict`, { image: base64 });
      const digit = String(response.data.prediction);

      // append the predicted digit and store the image for potential retraining
      setPredictedString(prev => prev + digit);
      setEditedString(prev => prev + digit);
      setCapturedImages(prev => [...prev, base64]);
    } catch (error) {
      console.error('Predict error:', error);
    } finally {
      setIsLoading(false);
      // clear so user can draw the next digit
      sigRef.current.clearSignature();
    }
  };

  // clear button just wipes the canvas and cancels any pending capture
  const handleClear = () => {
    if (strokeTimer.current) clearTimeout(strokeTimer.current);
    sigRef.current.clearSignature();
  };

  // compare edited string against original, retrain on any changed positions
  const handleConfirm = async () => {
    const corrections = [];
    for (let i = 0; i < predictedString.length; i++) {
      // only retrain if we have an image for this position and the user changed it
      if (i < editedString.length && capturedImages[i] && editedString[i] !== predictedString[i]) {
        corrections.push({ image: capturedImages[i], label: editedString[i] });
      }
    }

    if (corrections.length === 0) {
      setSuccessMessage('No corrections to send.');
      setTimeout(() => setSuccessMessage(''), 2000);
      return;
    }

    setIsLoading(true);
    try {
      for (const c of corrections) {
        await axios.post(`${SERVER_URL}/retrain`, { image: c.image, label: c.label });
      }
      setSuccessMessage('Model updated!');
    } catch (error) {
      console.error('Retrain error:', error);
      setSuccessMessage('Retrain failed.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setSuccessMessage(''), 2000);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* canvas fills all space above the bottom panel */}
      <View
        style={styles.canvasWrapper}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          setCanvasSize({ width, height });
        }}
      >
        <SignatureCanvas
          ref={sigRef}
          onEnd={handleEnd}
          onOK={handleOK}
          backgroundColor="black"
          penColor="white"
          descriptionText=""
          style={{ width: canvasSize.width, height: canvasSize.height }}
        />
        {/* small spinner in corner while waiting for server */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#5C4033" />
          </View>
        )}
      </View>

      {/* fixed bottom panel with all controls */}
      <View style={styles.bottomPanel}>
        {/* clear just the current drawing */}
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>

        {/* editable field where predicted digits appear */}
        <TextInput
          style={styles.textInput}
          value={editedString}
          onChangeText={setEditedString}
          placeholder="Predicted digits appear here"
          placeholderTextColor="#aaa"
        />

        {/* submit sends corrections to retrain the model */}
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>Submit</Text>
        </TouchableOpacity>

        {/* clear all resets everything so the user can start fresh */}
        <TouchableOpacity style={styles.clearButton} onPress={() => {
          setEditedString('');
          setPredictedString('');
          setCapturedImages([]);
          sigRef.current.clearSignature();
        }}>
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>

        {successMessage ? (
          <Text style={styles.successMessage}>{successMessage}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  canvasWrapper: {
    flex: 1,                // fills all space above the bottom panel
    backgroundColor: 'white',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  canvas: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  bottomPanel: {
    height: 220,
    width: '100%',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  clearButton: {
    width: '100%',
    backgroundColor: '#e0e0e0',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#333',
    fontSize: 14,
  },
  textInput: {
    width: '100%',
    backgroundColor: 'white',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
  },
  confirmButton: {
    width: '100%',
    backgroundColor: '#5C4033',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  successMessage: {
    color: '#5C4033',
    fontSize: 14,
    textAlign: 'center',
  },
});
