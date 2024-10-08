import * as React from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity } from "react-native";
import Scanner from './components/Scanner';
import type { PhotoFile } from 'react-native-vision-camera';
import * as DDN from "vision-camera-dynamsoft-document-normalizer";
import Cropper from './components/Cropper';
import ResultViewer from './components/ResultViewer';
import { useEffect } from 'react';


export default function App() {
  const [showScanner,setShowScanner] = React.useState(false);
  const [showCropper,setShowCropper] = React.useState(false);
  const [showResultViewer,setShowResultViewer] = React.useState(false);
  const [photoTaken,setPhotoTaken] = React.useState<PhotoFile|undefined>();
  const [photoPath,setPhotoPath] = React.useState<string>("");
  const [frameWidth,setFrameWidth] = React.useState<number|undefined>();
  const [frameHeight,setFrameHeight] = React.useState<number|undefined>();
  const [detectedQuad,setDetectedQuad] = React.useState<DDN.DetectedQuadResult|undefined>();
  const [isWhiteBackgroundEnabled,setIsWhiteBackgroundEnabled] = React.useState(false);
  const [points,setPoints] = React.useState<DDN.Point[]>([]);
  const [status,setStatus] = React.useState<string>("Initializing...");

  useEffect(() => {
    (async () => {
      let license = "t0086pwAAAIXUXzab0LCKbi/v4LuBwfy7IJ8yJU0X54XRoYUDqCCmC2YZ65tdS9hU2g9ZbA7QyRbf2nDVkffHtrpF8K0+CfGkx0rulHmPEncZajjlBS3sIr4="; //one-day public trial
      let result = await DDN.initLicense(license);
      console.log("Licesne valid: ");
      console.log(result);
      if (result === false) {
        Alert.alert("DDN","License invalid");
      }else{
        setStatus("");
      }
    })();
  }, []);
  
  const onPressed = () => {
    if (status === "Initializing...") {
      Alert.alert("DDN","Please wait for the initialization.");
    }else{
      setShowScanner(true);
    }
  }

  const onScanned = (photo:PhotoFile|null,enabled:boolean,detectedQuad:DDN.DetectedQuadResult,frameWidth:number,frameHeight:number) => {
    if (photo) {
      setShowScanner(false);
      setIsWhiteBackgroundEnabled(enabled);
      setDetectedQuad(detectedQuad);
      setFrameWidth(frameWidth);
      setFrameHeight(frameHeight);
      setPhotoTaken(photo);
      setShowCropper(true);
    }else{
      Alert.alert("Error","Failed to take a photo. Please try again.");
      setShowScanner(false);
    }
  }

  const renderBody = () => {
    if (showScanner) {
      return (
        <Scanner onScanned={onScanned}></Scanner>
      )
    }else if (showCropper){
      return (
        <Cropper 
          photo={photoTaken}
          isWhiteBackgroundEnabled={isWhiteBackgroundEnabled}
          liveDetectedQuad={detectedQuad}
          frameWidth={frameWidth}
          frameHeight={frameHeight}
          onCanceled={()=>{
            setShowCropper(false);
            setShowScanner(true);
          }}
          onConfirmed={(path,adjustedPoints)=>{
            setPhotoPath(path);
            setPoints(adjustedPoints);
            setShowCropper(false);
            setShowResultViewer(true);
          }}
        ></Cropper>
      )
    }else if (showResultViewer){
      return (
        <ResultViewer photoPath={photoPath} points={points} 
          onBack={()=>{
            setShowResultViewer(false);
          }}  
        ></ResultViewer>
      )
    }else{
      return (
        <>
          <TouchableOpacity
            style={styles.button}
            onPress={() => onPressed()}
          >
            <Text style={styles.buttonText}>Scan Document</Text>
          </TouchableOpacity>
          <Text>{status}</Text>
        </>
        )
    }
  }
  return (
    <SafeAreaView style={styles.container}>
      {renderBody()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:1,
  },
  info: {
    margin: 8,
  },
  button: {
    alignItems: "center",
    backgroundColor: "rgb(33, 150, 243)",
    margin: 8,
    padding: 10,
  },
  buttonText:{
    color: "#FFFFFF",
  },
});