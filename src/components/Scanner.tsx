import * as React from 'react';
import { Alert, Dimensions, Platform, SafeAreaView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { Camera, Orientation, PhotoFile, runAtTargetFps, useCameraDevice, useCameraFormat, useFrameProcessor, useSkiaFrameProcessor } from 'react-native-vision-camera';
import * as DDN from "vision-camera-dynamsoft-document-normalizer";
import type { DetectedQuadResult } from 'vision-camera-dynamsoft-document-normalizer';
import { useEffect, useRef, useState } from 'react';
import { Worklets,useSharedValue } from 'react-native-worklets-core';
import { intersectionOverUnion, sleep, getRectFromPoints } from '../Utils';
import { defaultTemplate, whiteTemplate } from '../Templates';
import { PointMode, Skia, SkPoint, vec } from '@shopify/react-native-skia';

export interface ScannerProps{
  onScanned?: (path:PhotoFile|null,isWhiteBackgroundEnabled:boolean,detectionResult:DetectedQuadResult,frameWidth:number,frameHeight:number) => void;
}

export default function Scanner(props:ScannerProps) {
  const [isWhiteBackgroundEnabled, setIsWhiteBackgroundEnabled] = useState(false);
  const isWhiteBackgroundEnabledShared = useSharedValue(false);
  const toggleSwitch = () => {
    isWhiteBackgroundEnabledShared.value = (!isWhiteBackgroundEnabled);
    setIsWhiteBackgroundEnabled(previousState => !previousState)
  };
  const camera = useRef<Camera|null>(null)
  const [isActive,setIsActive] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [detectionResults,setDetectionResults] = useState([] as DetectedQuadResult[]);
  const convertAndSetResults = (records:Record<string,DetectedQuadResult>,orientation:Orientation) => {
    let results:DetectedQuadResult[] = [];
    for (let index = 0; index < Object.keys(records).length; index++) {
      const result = records[Object.keys(records)[index]];
      rotatePoints(result,frameWidth.value,frameHeight.value,orientation)
      const rect = getRectFromPoints(result.location.points);
      if (rect.width / getFrameSize()[0].value < 0.95) { //avoid full screen misdetection
        results.push(result);
      }
    }
    setDetectionResults(results);
  }

  useEffect(() => {
    checkIfSteady();
  },[detectionResults]);

  const getFrameSize = () => {
    let width, height;
    if (frameWidth>frameHeight && Dimensions.get('window').width>Dimensions.get('window').height){
      width = frameWidth;
      height = frameHeight;
    }else {
      console.log("Has rotation");
      width = frameHeight;
      height = frameWidth;
    }
    return [width, height];
  }
  const convertAndSetResultsJS = Worklets.createRunOnJS(convertAndSetResults);
  const frameWidth = useSharedValue(1920);
  const frameHeight = useSharedValue(1080);
  const takenShared = useSharedValue(false);
  const photo = useRef<PhotoFile|null>(null);
  const previousResults = useRef([] as DetectedQuadResult[]);
  const device = useCameraDevice("back");
  const cameraFormat = useCameraFormat(device, [
    { videoResolution: { width: 1280, height: 720 } },
    {photoAspectRatio: 16/9 },
    {videoAspectRatio: 16/9 },
    { fps: 60 }
  ])
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    const updateSettings = async () => {
      if (isWhiteBackgroundEnabled) {
        console.log("use white template");
        await DDN.initRuntimeSettingsFromString(whiteTemplate);
      }else{
        await DDN.initRuntimeSettingsFromString(defaultTemplate);
      }
    }
    updateSettings();
  }, [isWhiteBackgroundEnabled]);

  const takePhoto = async () => {
    console.log("take photo");
    if (camera.current) {
      console.log("using camera");
      takenShared.value = true;
      await sleep(100);
      try{
        photo.current = await camera.current.takePhoto();
      }catch(e){
        console.log(e);
      }
      if (photo.current) {
        console.log(photo.current);
        setIsActive(false);
        let detectionResult = JSON.parse(JSON.stringify(detectionResults[0]));
        previousResults.current = [];
        setDetectionResults([]);
        if (Platform.OS === "android") {
          if (photo.current.metadata && photo.current.metadata.Orientation === 6) {
            console.log("rotate bitmap for Android");
            await DDN.rotateFile(photo.current.path,90);
          }
        }
        if (props.onScanned) {
          console.log(photo.current);
          props.onScanned(
            photo.current,
            isWhiteBackgroundEnabled,
            detectionResult,
            getFrameSize()[0].value,
            getFrameSize()[1].value
          );
        }
      }else{
        Alert.alert("","Failed to take a photo");
        takenShared.value = false;
      }
    }
  }

  const checkIfSteady = async () => {
    if (detectionResults.length == 0) {
      return;
    }
    let result = detectionResults[0];
    console.log("previousResults");
    console.log(previousResults);
    if (result) {
      if (previousResults.current.length >= 2) {
        previousResults.current.push(result);
        if (steady() == true) {
          await takePhoto();
          console.log("steady");
        }else{
          console.log("shift result");
          previousResults.current.shift();
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

  const rotatePoints = (result:DetectedQuadResult,_frameWidth:number,frameHeight:number,orientation:Orientation) => {
   console.log("rotate points");
    console.log(orientation)
    for (let index = 0; index < result.location.points.length; index++) {
      const point = result.location.points[index];
      if (point) {
        if (orientation === "landscape-right") {
          let x = point.x;
          point.x = frameHeight - point.y;
          point.y = x;
        }
      }
    }
    result.location.points = pointsSorted(result.location.points) as [DDN.Point,DDN.Point,DDN.Point,DDN.Point];
  };

  const pointsSorted = (points:DDN.Point[]):DDN.Point[] => {
    let size = getFrameSize();
    let width = size[0];
    let height = size[1];
    let centerX = width.value/2;
    let centerY = height.value/2;
    let topLeftResult;
    let topRightResult;
    let bottomRightResult;
    let bottomLeftResult;
    for (let index = 0; index < points.length; index++) {
      const result = points[index];
      if (result.x - centerX < 0 && result.y - centerY < 0) {
        topLeftResult = result;
      }else if (result.x - centerX > 0 && result.y - centerY < 0) {
        topRightResult = result;
      }else if (result.x - centerX > 0 && result.y - centerY > 0) {
        bottomRightResult = result;
      }else if (result.x - centerX < 0 && result.y - centerY > 0) {
        bottomLeftResult = result;
      }
    }
    return [topLeftResult,topRightResult,bottomRightResult,bottomLeftResult] as DDN.Point[];
  }

  const frameProcessor = useSkiaFrameProcessor((frame) => {
    'worklet'
    frame.render();
    const points:SkPoint[] = [];
    if (takenShared.value === false) {
        try {
          const results = DDN.detect(frame);
          if (Object.keys(results).length>0) {
            console.log(results[0]);
            for (let index = 0; index < results[0].location.points.length; index++) {
              const point = results[0].location.points[index];
              points.push(point);
            }
            points.push(results[0].location.points[0]);
            console.log("draw points");
            console.log(points);
          }
          frameWidth.value = frame.width;
          frameHeight.value = frame.height;
          convertAndSetResultsJS(results,frame.orientation);
        } catch (error) {
          console.log(error);
        }
    }
    if (points.length>0) {
      const paint = Skia.Paint()
      paint.setColor(Skia.Color('red'))
      paint.setStrokeWidth(5);
      frame.drawPoints(PointMode.Polygon,points,paint);
    }
  }, [])



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
              format={cameraFormat}
              frameProcessor={frameProcessor}
              pixelFormat='yuv'
            />
            <View style={styles.control}>
              <Text>Enable White Background Template:</Text>
              <Switch
                trackColor={{false: '#767577', true: '#81b0ff'}}
                thumbColor={isWhiteBackgroundEnabled ? '#f5dd4b' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={toggleSwitch}
                value={isWhiteBackgroundEnabled}
              />
            </View>
        </>)}
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  control:{
    flexDirection:"row",
    position: 'absolute',
    bottom: 0,
    height: 100,
    width:"100%",
    alignSelf:"flex-start",
    alignItems: 'center',
    backgroundColor:'rgba(255, 255, 255, 0.5)',
  },
});
