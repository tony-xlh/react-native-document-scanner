import * as React from 'react';
import { Alert, Dimensions, Platform, SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import { Camera, PhotoFile, runAtTargetFps, useCameraDevice, useCameraDevices, useCameraFormat, useFrameProcessor } from 'react-native-vision-camera';
import * as DDN from "vision-camera-dynamsoft-document-normalizer";
import { Svg, Polygon } from 'react-native-svg';
import type { DetectedQuadResult } from 'vision-camera-dynamsoft-document-normalizer';
import { useEffect, useRef, useState } from 'react';
import { Worklets,useSharedValue } from 'react-native-worklets-core';
import { intersectionOverUnion, sleep } from '../Utils';

export interface ScannerProps{
    onScanned?: (path:PhotoFile|null,isWhiteBackgroundEnabled:boolean) => void;
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
  const convertAndSetResults = (records:Record<string,DetectedQuadResult>) => {
    let results:DetectedQuadResult[] = [];
    for (let index = 0; index < Object.keys(records).length; index++) {
      const result = records[Object.keys(records)[index]];
      results.push(result);
    }
    setDetectionResults(results);
  }
  const convertAndSetResultsJS = Worklets.createRunOnJS(convertAndSetResults);
  const frameWidth = useSharedValue(1920);
  const frameHeight = useSharedValue(1080);
  const [viewBox,setViewBox] = useState("0 0 1080 1920");
  const [pointsText, setPointsText] = useState("default");
  const takenShared = useSharedValue(false);
  const [taken,setTaken] = useState(false);
  const photo = useRef<PhotoFile|null>(null);
  const previousResults = useRef([] as DetectedQuadResult[]);
  const device = useCameraDevice("back");
  const cameraFormat = useCameraFormat(device, [
    { videoResolution: { width: 1280, height: 720 } },
    { fps: 60 }
  ])
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
      let result = await DDN.initLicense("DLS2eyJoYW5kc2hha2VDb2RlIjoiMjAwMDAxLTE2NDk4Mjk3OTI2MzUiLCJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSIsInNlc3Npb25QYXNzd29yZCI6IndTcGR6Vm05WDJrcEQ5YUoifQ==");
      console.log("Licesne valid: ");
      console.log(result);
      if (result === false) {
        Alert.alert("DDN","License invalid");
      }
      await DDN.initRuntimeSettingsFromString(`{"CaptureVisionTemplates": [{"Name": "Default"},{"Name": "DetectDocumentBoundaries_Default","ImageROIProcessingNameArray": ["roi-detect-document-boundaries"]},{"Name": "DetectAndNormalizeDocument_Binary","ImageROIProcessingNameArray": ["roi-detect-and-normalize-document-binary"]},{"Name": "DetectAndNormalizeDocument_Gray","ImageROIProcessingNameArray": ["roi-detect-and-normalize-document-gray"]},{"Name": "DetectAndNormalizeDocument_Color","ImageROIProcessingNameArray": ["roi-detect-and-normalize-document-color"]},{"Name": "NormalizeDocument_Binary","ImageROIProcessingNameArray": ["roi-normalize-document-binary"]},{"Name": "NormalizeDocument_Gray","ImageROIProcessingNameArray": ["roi-normalize-document-gray"]},{"Name": "NormalizeDocument_Color","ImageROIProcessingNameArray": ["roi-normalize-document-color"]},{"Name": "DetectAndNormalizeDocument_General","ImageROIProcessingNameArray": ["roi-detect-and-normalize-document"]},{"Name": "DetectAndNormalizeDocument_HSV","ImageROIProcessingNameArray": ["roi-detect-and-normalize-document-hsv"]},{"Name": "Detect_General","ImageROIProcessingNameArray": ["roi-detect-general"]},{"Name": "Detect_HSV","ImageROIProcessingNameArray": ["roi-detect-hsv"]}],"TargetROIDefOptions": [{"Name": "roi-detect-document-boundaries","TaskSettingNameArray": ["task-detect-document-boundaries"]},{"Name": "roi-detect-and-normalize-document-binary","TaskSettingNameArray": ["task-detect-and-normalize-document-binary"]},{"Name": "roi-detect-and-normalize-document-gray","TaskSettingNameArray": ["task-detect-and-normalize-document-gray"]},{"Name": "roi-detect-and-normalize-document-color","TaskSettingNameArray": ["task-detect-and-normalize-document-color"]},{"Name": "roi-normalize-document-binary","TaskSettingNameArray": ["task-normalize-document-binary"]},{"Name": "roi-normalize-document-gray","TaskSettingNameArray": ["task-normalize-document-gray"]},{"Name": "roi-normalize-document-color","TaskSettingNameArray": ["task-normalize-document-color"]},{"Name": "roi-detect-and-normalize-document","TaskSettingNameArray": ["task-detect-and-normalize-document"]},{"Name": "roi-detect-and-normalize-document-hsv","TaskSettingNameArray": ["task-detect-and-normalize-document-hsv"]},{"Name": "roi-detect-general","TaskSettingNameArray": ["task-detect-general"]},{"Name": "roi-detect-hsv","TaskSettingNameArray": ["task-detect-hsv"]}],"DocumentNormalizerTaskSettingOptions": [{"Name": "task-detect-and-normalize-document-binary","ColourMode": "ICM_BINARY","SectionImageParameterArray": [{"Section": "ST_REGION_PREDETECTION","ImageParameterName": "ip-detect-and-normalize"},{"Section": "ST_DOCUMENT_DETECTION","ImageParameterName": "ip-detect-and-normalize"},{"Section": "ST_DOCUMENT_NORMALIZATION","ImageParameterName": "ip-detect-and-normalize"}]},{"Name": "task-detect-and-normalize-document-gray","ColourMode": "ICM_GRAYSCALE","SectionImageParameterArray": [{"Section": "ST_REGION_PREDETECTION","ImageParameterName": "ip-detect-and-normalize"},{"Section": "ST_DOCUMENT_DETECTION","ImageParameterName": "ip-detect-and-normalize"},{"Section": "ST_DOCUMENT_NORMALIZATION","ImageParameterName": "ip-detect-and-normalize"}]},{"Name": "task-detect-and-normalize-document-color","ColourMode": "ICM_COLOUR","SectionImageParameterArray": [{"Section": "ST_REGION_PREDETECTION","ImageParameterName": "ip-detect-and-normalize"},{"Section": "ST_DOCUMENT_DETECTION","ImageParameterName": "ip-detect-and-normalize"},{"Section": "ST_DOCUMENT_NORMALIZATION","ImageParameterName": "ip-detect-and-normalize"}]},{"Name": "task-detect-document-boundaries","TerminateSetting": {"Section": "ST_DOCUMENT_DETECTION"},"SectionImageParameterArray": [{"Section": "ST_REGION_PREDETECTION","ImageParameterName": "ip-detect"},{"Section": "ST_DOCUMENT_DETECTION","ImageParameterName": "ip-detect"},{"Section": "ST_DOCUMENT_NORMALIZATION","ImageParameterName": "ip-detect"}]},{"Name": "task-normalize-document-binary","StartSection": "ST_DOCUMENT_NORMALIZATION","ColourMode": "ICM_BINARY","SectionImageParameterArray": [{"Section": "ST_REGION_PREDETECTION","ImageParameterName": "ip-normalize"},{"Section": "ST_DOCUMENT_DETECTION","ImageParameterName": "ip-normalize"},{"Section": "ST_DOCUMENT_NORMALIZATION","ImageParameterName": "ip-normalize"}]},{"Name": "task-normalize-document-gray","ColourMode": "ICM_GRAYSCALE","StartSection": "ST_DOCUMENT_NORMALIZATION","SectionImageParameterArray": [{"Section": "ST_REGION_PREDETECTION","ImageParameterName": "ip-normalize"},{"Section": "ST_DOCUMENT_DETECTION","ImageParameterName": "ip-normalize"},{"Section": "ST_DOCUMENT_NORMALIZATION","ImageParameterName": "ip-normalize"}]},{"Name": "task-normalize-document-color","ColourMode": "ICM_COLOUR","StartSection": "ST_DOCUMENT_NORMALIZATION","SectionImageParameterArray": [{"Section": "ST_REGION_PREDETECTION","ImageParameterName": "ip-normalize"},{"Section": "ST_DOCUMENT_DETECTION","ImageParameterName": "ip-normalize"},{"Section": "ST_DOCUMENT_NORMALIZATION","ImageParameterName": "ip-normalize"}]},{"Name": "task-detect-and-normalize-document","SectionImageParameterArray": [{"Section": "ST_REGION_PREDETECTION","ImageParameterName": "ip-detect-and-normalize"},{"Section": "ST_DOCUMENT_DETECTION","ImageParameterName": "ip-detect-and-normalize"},{"Section": "ST_DOCUMENT_NORMALIZATION","ImageParameterName": "ip-detect-and-normalize"}]},{"Name": "task-detect-and-normalize-document-hsv","SectionImageParameterArray": [{"Section": "ST_REGION_PREDETECTION","ImageParameterName": "ip-detect-and-normalize-hsv"},{"Section": "ST_DOCUMENT_DETECTION","ImageParameterName": "ip-detect-and-normalize-hsv"},{"Section": "ST_DOCUMENT_NORMALIZATION","ImageParameterName": "ip-detect-and-normalize-hsv"}]},{"Name": "task-detect-general","TerminateSetting": {"Section": "ST_DOCUMENT_DETECTION"},"SectionImageParameterArray": [{"Section": "ST_REGION_PREDETECTION","ImageParameterName": "ip-detect-and-normalize"},{"Section": "ST_DOCUMENT_DETECTION","ImageParameterName": "ip-detect-and-normalize"},{"Section": "ST_DOCUMENT_NORMALIZATION","ImageParameterName": "ip-detect-and-normalize"}]},{"Name": "task-detect-hsv","TerminateSetting": {"Section": "ST_DOCUMENT_DETECTION"},"SectionImageParameterArray": [{"Section": "ST_REGION_PREDETECTION","ImageParameterName": "ip-detect-and-normalize-hsv"},{"Section": "ST_DOCUMENT_DETECTION","ImageParameterName": "ip-detect-and-normalize-hsv"},{"Section": "ST_DOCUMENT_NORMALIZATION","ImageParameterName": "ip-detect-and-normalize-hsv"}]}],"ImageParameterOptions": [{"Name": "ip-detect-and-normalize","BinarizationModes": [{"Mode": "BM_LOCAL_BLOCK","BlockSizeX": 0,"BlockSizeY": 0,"EnableFillBinaryVacancy": 0}],"TextDetectionMode": {"Mode": "TTDM_WORD","Direction": "HORIZONTAL","Sensitivity": 7}},{"Name": "ip-detect","BinarizationModes": [{"Mode": "BM_LOCAL_BLOCK","BlockSizeX": 0,"BlockSizeY": 0,"EnableFillBinaryVacancy": 0,"ThresholdCompensation": 7}],"TextDetectionMode": {"Mode": "TTDM_WORD","Direction": "HORIZONTAL","Sensitivity": 7},"ScaleDownThreshold": 512},{"Name": "ip-normalize","BinarizationModes": [{"Mode": "BM_LOCAL_BLOCK","BlockSizeX": 0,"BlockSizeY": 0,"EnableFillBinaryVacancy": 0}],"TextDetectionMode": {"Mode": "TTDM_WORD","Direction": "HORIZONTAL","Sensitivity": 7}},{"Name": "ip-detect-and-normalize-hsv","BinarizationModes": [{"Mode": "BM_LOCAL_BLOCK","BlockSizeX": 0,"BlockSizeY": 0,"EnableFillBinaryVacancy": 0,"ThresholdCompensation": 5}],"TextDetectionMode": {"Mode": "TTDM_WORD","Direction": "HORIZONTAL","Sensitivity": 7},"ColourConversionModes": [{"Mode": "CICM_HSV","ReferChannel": "H_CHANNEL"}]}]}`);
    })();
  }, []);

  useEffect(() => {
    updateViewBox();
    updatePointsData();
  }, [detectionResults]);

  const getFrameSize = () => {
    let width, height;
    if (Platform.OS === 'android') {
      if (frameWidth>frameHeight && Dimensions.get('window').width>Dimensions.get('window').height){
        width = frameWidth;
        height = frameHeight;
      }else {
        console.log("Has rotation");
        width = frameHeight;
        height = frameWidth;
      }
    } else {
      width = frameWidth;
      height = frameHeight;
    }
    return [width, height];
  }

  const updateViewBox = () => {
    const frameSize = getFrameSize();
    setViewBox("0 0 "+frameSize[0]+" "+frameSize[1]);
    console.log("viewBox"+viewBox);
  }

  const updatePointsData = () => {
    if (detectionResults.length>0) {
      let result = detectionResults[0];
      if (result) {
        let location = result.location;
        let pointsData = location.points[0].x + "," + location.points[0].y + " ";
        pointsData = pointsData + location.points[1].x + "," + location.points[1].y +" ";
        pointsData = pointsData + location.points[2].x + "," + location.points[2].y +" ";
        pointsData = pointsData + location.points[3].x + "," + location.points[3].y;
        setPointsText(pointsData);
      }
    }
  }
  
  useEffect(() => {
    if (pointsText != "default") {
      console.log("pointsText changed");
      checkIfSteady();
    }
  }, [pointsText]);


  const takePhoto = async () => {
    console.log("take photo");
    if (camera.current) {
      console.log("using camera");
      setTaken(true);
      takenShared.value = true;
      await sleep(1000);
      photo.current = await camera.current.takePhoto();
      if (photo.current) {
        console.log(photo.current);
        setIsActive(false);
        if (Platform.OS === "android") {
          if (photo.current.metadata && photo.current.metadata.Orientation === 6) {
            console.log("rotate bitmap for Android");
            await DDN.rotateFile(photo.current.path,90);
          }
        }
        if (props.onScanned) {
          console.log(photo.current);
          props.onScanned(photo.current,isWhiteBackgroundEnabled);
        }
      }else{
        Alert.alert("","Failed to take a photo");
        setTaken(false);
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

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'
    console.log("detect frame");
    console.log(frame.toString());
    if (takenShared.value === false) {
      runAtTargetFps(3, () => {
        'worklet'
        try {
          let template = isWhiteBackgroundEnabledShared.value ? "Detect_HSV":"";
          console.log("template: "+template);
          const results = DDN.detect(frame,template);
          console.log(results);
          if (Object.keys(results).length>0) {
            frameWidth.value = frame.width;
            frameHeight.value = frame.height;
            convertAndSetResultsJS(results);
          }
        } catch (error) {
          console.log(error);
        }
      })
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
              frameProcessor={taken ? undefined: frameProcessor}
              pixelFormat='yuv'
            />
            <Svg preserveAspectRatio='xMidYMid slice' style={StyleSheet.absoluteFill} viewBox={viewBox}>
              {pointsText != "default" && (
                <Polygon
                  points={pointsText}
                  fill="lime"
                  stroke="green"
                  opacity="0.5"
                  strokeWidth="1"
                />
              )}
            </Svg>
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
