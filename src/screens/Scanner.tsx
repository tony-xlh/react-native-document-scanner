import * as React from 'react';
import { Alert, Dimensions, Image, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, useCameraDevices, useFrameProcessor } from 'react-native-vision-camera';
import * as DDN from "vision-camera-dynamsoft-document-normalizer";
import { Svg, Polygon } from 'react-native-svg';
import * as REA from 'react-native-reanimated';
import type { DetectedQuadResult, Point, Quadrilateral } from 'vision-camera-dynamsoft-document-normalizer';
import { useEffect, useRef, useState } from 'react';
import { intersectionOverUnion } from '../Utils';

export default function ScannerScreen({route, navigation}) {
  const camera = useRef<Camera>(null)
  const [isActive, setIsActive] = useState(true);
  const widthRatio = useRef(1);
  const heightRatio = useRef(1);
  const [hasPermission, setHasPermission] = useState(false);
  const detectionResults = REA.useSharedValue([] as DetectedQuadResult[]);
  const frameWidth = REA.useSharedValue(0);
  const frameHeight = REA.useSharedValue(0);
  const platform = REA.useSharedValue("");
  const screenWidth = REA.useSharedValue(0);
  const screenHeight = REA.useSharedValue(0);
  const [pointsText, setPointsText] = useState("default");
  const taken = REA.useSharedValue(false);
  const [photoPath, setPhotoPath] = useState<undefined|string>(undefined);
  const previousResults = useRef([] as DetectedQuadResult[]);

  const viewBox = REA.useDerivedValue(() => {
    console.log("update viewbox");
    let viewBox = "";
    let rotated = false;
    if (platform.value === "android") {
      if (screenWidth.value>screenHeight.value) {
        if (frameWidth.value<frameHeight.value) {
          rotated = true;
        }
      }else{
        if (frameWidth.value>frameHeight.value) {
          rotated = true;
        }
      }
    }
    if (rotated) {
      viewBox = "0 0 "+frameHeight.value+" "+frameWidth.value;
    }else{
      viewBox = "0 0 "+frameWidth.value+" "+frameHeight.value;
    }
    console.log(viewBox);
    return viewBox;
  }, [frameWidth,frameHeight]);
  const pointsData = REA.useDerivedValue(() => {
    console.log("update pointsData");
    let data = "";
    if (detectionResults.value.length>0) {
      let result = detectionResults.value[0];
      if (result) {
        let location = result.location;
        let pointsData = location.points[0].x + "," + location.points[0].y + " ";
        pointsData = pointsData + location.points[1].x + "," + location.points[1].y +" ";
        pointsData = pointsData + location.points[2].x + "," + location.points[2].y +" ";
        pointsData = pointsData + location.points[3].x + "," + location.points[3].y;
        data = pointsData;
      }
    }
    REA.runOnJS(setPointsText)(data);
    console.log(data);
    return data;
  }, [detectionResults]);
  const devices = useCameraDevices();
  const device = devices.back;
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'
    console.log(frame);
    if (taken.value === false) {
      const results = DDN.detect(frame);
      console.log(results);
      frameWidth.value = frame.width;
      frameHeight.value = frame.height;
      detectionResults.value = results;
    }
  }, [])

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'authorized');
      let result = await DDN.initLicense("DLS2eyJoYW5kc2hha2VDb2RlIjoiMjAwMDAxLTE2NDk4Mjk3OTI2MzUiLCJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSIsInNlc3Npb25QYXNzd29yZCI6IndTcGR6Vm05WDJrcEQ5YUoifQ==");
      console.log("Licesne valid: ");
      console.log(result);
      if (result === false) {
        Alert.alert("DDN","License invalid");
      }
    })();
    platform.value = Platform.OS;
    screenWidth.value = Dimensions.get('window').width;
    screenHeight.value = Dimensions.get('window').height;
  }, []);

  useEffect(() => {
    console.log("pointsText changed");
    checkIfSteady();
  }, [pointsText]);


  const takePhoto = async () => {
    console.log("take photo");
    if (camera.current) {
      taken.value = true;
      console.log("using camera");
      const photo = await camera.current.takePhoto();
      setIsActive(false);
      console.log(photo);
      let photoWidth = photo.width;
      let photoHeight = photo.height;
      if (platform.value === "android") {
        if (photo.metadata.Orientation === 6) {
          console.log("rotate bitmap for Android");
          await DDN.rotateFile(photo.path,90);
          photoWidth = photo.height;
          photoHeight = photo.width;
        }
      }
      frameWidth.value = photoWidth;
      frameHeight.value = photoHeight;
      detectionResults.value = await DDN.detectFile(photo.path);
      setPhotoPath(photo.path);
      //setIsActive(false);
    }
  }

  const checkIfSteady = async () => {
    let result = detectionResults.value[0];
    console.log("previousResults");
    console.log(previousResults);
    if (result) {
      if (previousResults.current.length >= 3) {
        if (steady() == true) {
          await takePhoto();
          console.log("steady");
        }else{
          console.log("shift and add result");
          previousResults.current.shift();
          previousResults.current.push(result);
        }
      }else{
        console.log("add result");
        previousResults.current.push(result);
      }
    }
  }

  const steady = () => {
    if (previousResults.current[0] && previousResults.current[1] && previousResults.current[2]) {
      let iou1 = intersectionOverUnion(previousResults.current[0].location.points,previousResults.current[1].location.points);
      let iou2 = intersectionOverUnion(previousResults.current[1].location.points,previousResults.current[2].location.points);
      let iou3 = intersectionOverUnion(previousResults.current[0].location.points,previousResults.current[2].location.points);
      console.log(iou1);
      console.log(iou2);
      console.log(iou3);
      if (iou1>0.9 && iou2>0.9 && iou3>0.9) {
        return true;
      }else{
        return false;
      }
    }
    return false;
  }

  const retake = () => {
    detectionResults.value = [];
    previousResults.current = [];
    setPhotoPath(undefined);
    taken.value = false;
    setIsActive(true)
  }

  const okay = () => {
    console.log("okay");
    if (detectionResults.value.length === 0) {
      Alert.alert("Error","No detected documents");
      return;
    }
    let result = detectionResults.value[0];
    navigation.navigate(
      {
        params: {photoPath:photoPath, detectionResult:result},
        name: "ResultViewer"
      }
    );
  }

  return (
      <SafeAreaView style={styles.container}>
        {device != null &&
        hasPermission && (
        <>
            <Camera
              style={StyleSheet.absoluteFill}
              ref={camera}
              isActive={isActive}
              device={device}
              photo={true}
              frameProcessor={frameProcessor}
              frameProcessorFps={5}
            />
            {photoPath && (
              <>
                <Image
                  style={StyleSheet.absoluteFill}
                  source={{uri:"file://"+photoPath}}
                />
              </>
            )}
            <Svg preserveAspectRatio='xMidYMid slice' style={StyleSheet.absoluteFill} viewBox={viewBox.value}>
              <Polygon
                points={pointsData.value}
                fill="lime"
                stroke="green"
                opacity="0.5"
                strokeWidth="1"
              />
            </Svg>
            {photoPath && (
              <>
                <View style={styles.control}>
                  <View style={{flex:0.5}}>
                    <TouchableOpacity onPress={retake} style={styles.button}>
                      <Text style={{fontSize: 15, color: "black", alignSelf: "center"}}>Retake</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{flex:0.5}}>
                    <TouchableOpacity onPress={okay} style={styles.button}>
                      <Text style={{fontSize: 15, color: "black", alignSelf: "center"}}>Okay</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
        </>)}
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  text: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
  control:{
    flexDirection:"row",
    position: 'absolute',
    bottom: 0,
    height: "15%",
    width:"100%",
    alignSelf:"flex-start",
    alignItems: 'center',
  },
  button: {
    backgroundColor: "ghostwhite",
    borderColor:"black",
    borderWidth:2,
    borderRadius:5,
    padding: 8,
    margin: 3,
  },
});
