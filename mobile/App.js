import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
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
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [serverConnected, setServerConnected] = useState(null); // null = unknown, true/false
  const [lastPrediction, setLastPrediction] = useState('');     // "digit (confidence%)"
  const [retrainLog, setRetrainLog] = useState([]);             // lines shown in the log

  // check if server is reachable
  const checkServer = async () => {
    try {
      await axios.get(`${SERVER_URL}/health`, { timeout: 3000 });
      setServerConnected(true);
    } catch {
      setServerConnected(false);
    }
  };

  // check on startup and then every 10 seconds
  useEffect(() => {
    checkServer();
    const interval = setInterval(checkServer, 10000);
    return () => clearInterval(interval);
  }, []);

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
      const confidence = response.data.confidence ?? 'N/A';

      setLastPrediction(`${digit} (${confidence}%)`);

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
  const handleSubmit = async () => {
    const corrections = [];
    for (let i = 0; i < predictedString.length; i++) {
      // only retrain if we have an image for this position and the user changed it
      if (i < editedString.length && capturedImages[i] && editedString[i] !== predictedString[i]) {
        corrections.push({ index: i, image: capturedImages[i], original: predictedString[i], corrected: editedString[i] });
      }
    }

    if (corrections.length === 0) {
      setRetrainLog(prev => [...prev, 'No corrections needed']);
      return;
    }

    setIsLoading(true);
    try {
      for (const c of corrections) {
        await axios.post(`${SERVER_URL}/retrain`, { image: c.image, label: c.corrected });
        setRetrainLog(prev => [...prev, `Position ${c.index + 1}: ${c.original} → ${c.corrected}, retrained`]);

        // re-predict with the same image to update confidence
        const res = await axios.post(`${SERVER_URL}/predict`, { image: c.image });
        setLastPrediction(`${res.data.prediction} (${res.data.confidence}%)`);
      }
    } catch (error) {
      console.error('Retrain error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // clear all resets everything including the log
  const handleClearAll = () => {
    setEditedString('');
    setPredictedString('');
    setCapturedImages([]);
    setRetrainLog([]);
    setLastPrediction('');
    sigRef.current.clearSignature();
  };

  // server status dot colour and label
  const dotColor = serverConnected === true ? '#4CAF50' : serverConnected === false ? '#F44336' : '#aaa';
  const statusText = serverConnected === true ? 'Server: connected' : serverConnected === false ? 'Server: disconnected' : 'Server: checking...';

  return (
    <SafeAreaView style={styles.container}>
      {/* server status header */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

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

      {/* bottom panel with all controls */}
      <View style={styles.bottomPanel}>
        {/* confidence score from last prediction */}
        <Text style={styles.confidenceText}>
          {lastPrediction ? `Last prediction: ${lastPrediction}` : 'Draw a digit to begin'}
        </Text>

        {/* editable field where predicted digits appear */}
        <TextInput
          style={styles.textInput}
          value={editedString}
          onChangeText={setEditedString}
          placeholder="Predicted digits appear here"
          placeholderTextColor="#aaa"
        />

        {/* scrollable retrain log - max 5 lines visible */}
        <ScrollView style={styles.logArea} nestedScrollEnabled>
          {retrainLog.length === 0
            ? <Text style={styles.logLine}>Retrain log will appear here</Text>
            : retrainLog.map((line, i) => (
                <Text key={i} style={styles.logLine}>{line}</Text>
              ))
          }
        </ScrollView>

        {/* button row: Clear, Clear All, Submit */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.greyButton} onPress={handleClear}>
            <Text style={styles.greyButtonText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.greyButton} onPress={handleClearAll}>
            <Text style={styles.greyButtonText}>Clear All</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    color: '#555',
  },
  canvasWrapper: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  bottomPanel: {
    height: 320,
    width: '100%',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  confidenceText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
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
  logArea: {
    backgroundColor: 'white',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxHeight: 100, // about 5 lines
  },
  logLine: {
    fontSize: 12,
    color: '#555',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  greyButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  greyButtonText: {
    color: '#333',
    fontSize: 14,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#5C4033',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
