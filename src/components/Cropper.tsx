import React, { useEffect, useRef, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View} from "react-native";
import * as DDN from "vision-camera-dynamsoft-document-normalizer";
import type { Point } from "vision-camera-dynamsoft-document-normalizer";
import type { PhotoFile } from "react-native-vision-camera";
import { Canvas, Fill, useImage, Image, vec, Rect, Points } from "@shopify/react-native-skia";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { runOnJS, useDerivedValue, useSharedValue } from "react-native-reanimated";

export interface CropperProps{
  photo:PhotoFile|undefined;
  isWhiteBackgroundEnabled:boolean;
  liveDetectedQuad:DDN.DetectedQuadResult|undefined;
  frameWidth:number;
  frameHeight:number;
  onCanceled?: () => void;
  onConfirmed?: (photoPath:string,points:DDN.Point[]) => void;
}

const defalutPoints = [{x:100,y:50},{x:200,y:50},{x:200,y:100},{x:100,y:100}];

export default function Cropper(props:CropperProps) {
  const image = useImage("file://"+props.photo!.path);
  const { width, height } = useWindowDimensions();
  const points = useSharedValue(defalutPoints);
  const [detecting,setDetecting] = useState(true);
  const polygonPoints = useDerivedValue(() => {
    return [vec(points.value[0].x,points.value[0].y),
    vec(points.value[1].x,points.value[1].y),
    vec(points.value[2].x,points.value[2].y),
    vec(points.value[3].x,points.value[3].y),
    vec(points.value[0].x,points.value[0].y)];
  },[points]);
  const [selectedIndex,setSelectedIndex] = useState(-1);
  const rectWidth = 10;
  const rect1X = useDerivedValue(() => {
    return points.value[0].x - rectWidth;
  },[points]);
  const rect1Y = useDerivedValue(() => {
    return points.value[0].y - rectWidth;
  },[points]);
  const rect2X = useDerivedValue(() => {
    return points.value[1].x;
  },[points]);
  const rect2Y = useDerivedValue(() => {
    return points.value[1].y - rectWidth;
  },[points]);
  const rect3X = useDerivedValue(() => {
    return points.value[2].x;
  },[points]);
  const rect3Y = useDerivedValue(() => {
    return points.value[2].y;
  },[points]);
  const rect4X = useDerivedValue(() => {
    return points.value[3].x - rectWidth;
  },[points]);
  const rect4Y = useDerivedValue(() => {
    return points.value[3].y;
  },[points]);

  useEffect(() => {
    if (props.photo) {
      let photo:PhotoFile = props.photo;
      let inconsistentFrameAndPhotoOrientation = false;
      if (props.frameWidth>props.frameHeight && photo.width<photo.height) {
        inconsistentFrameAndPhotoOrientation = true;
      }else if (props.frameWidth<props.frameHeight && photo.width>photo.height) {
        inconsistentFrameAndPhotoOrientation = true;
      }
      if (inconsistentFrameAndPhotoOrientation) {
        swithWidthAndHeightOfPhoto(photo);
      }
      detectFile(photo.path);
    }
  }, []);

  const swithWidthAndHeightOfPhoto = (photo:PhotoFile) => {
    let tmp = photo.height;
    photo.height = photo.width;
    photo.width = tmp;
  }

  const detectFile = async (path:string) => {
    if (props.frameWidth && props.frameHeight && props.liveDetectedQuad) {
      if (props.photo) {
        if (props.frameWidth/props.frameHeight == props.photo.width/props.photo.height) {
          //console.log(props);
          console.log("use live detection result");
          let detectedPoints = JSON.parse(JSON.stringify(props.liveDetectedQuad.location.points));
          console.log("points:");
          console.log(detectedPoints);
          for (let index = 0; index < detectedPoints.length; index++) {
            const point = detectedPoints[index];
            point.x = Math.ceil(point.x / (props.frameWidth / props.photo.width));
            point.y = Math.ceil(point.y / (props.frameHeight / props.photo.height));
            point.x = Math.min(props.photo.width,point.x);
            point.y = Math.min(props.photo.height,point.y);
          }
          console.log("scaled points:");
          console.log(detectedPoints);
          points.value = scaledPoints(detectedPoints);
          setDetecting(false);
          return;
        }
      }
    }
    console.log("detect file");
    let results = await DDN.detectFile(path);
    if (results.length>0 && results[0]) {
      points.value = scaledPoints(results[0].location.points);
    }
    setDetecting(false);
  }


  const retake = () => {
    if (props.onCanceled) {
      props.onCanceled()
    }
  }

  const okay = () => {
    if (props.onConfirmed && points.value && props.photo) {
      props.onConfirmed(props.photo.path,pointsScaledBack())
    }
  }
  const scaledPoints = (detectedPoints:[Point,Point,Point,Point]) => {
    let photoWidth:number = props.photo!.width;
    let photoHeight:number = props.photo!.height;
    let newPoints = [];
    let {displayedWidth, displayedHeight} = getDisplayedSize();
    console.log("photo width: "+photoWidth);
    console.log("photo height: "+photoHeight);
    console.log("frame width: "+props.frameWidth);
    console.log("frame height: "+props.frameHeight);
    console.log("device width: "+width);
    console.log("device height: "+height);
    console.log("displayed width: "+displayedWidth);
    console.log("displayed height: "+displayedHeight);
    let widthDiff = (width - displayedWidth) / 2;
    let heightDiff = (height - displayedHeight) / 2;
    let xRatio = displayedWidth / photoWidth;
    let yRatio = displayedHeight / photoHeight;
    for (let index = 0; index < detectedPoints.length; index++) {
      const point = detectedPoints[index];
      const x = point.x * xRatio + widthDiff;
      const y = point.y * yRatio + heightDiff;
      newPoints.push({x:x,y:y});
    }
    return newPoints;
  };

  const pointsScaledBack = () => {
    let photoWidth:number = props.photo!.width;
    let photoHeight:number = props.photo!.height;
    let newPoints = [];
    let {displayedWidth, displayedHeight} = getDisplayedSize();
    let widthDiff = (width - displayedWidth) / 2;
    let heightDiff = (height - displayedHeight) / 2;
    let xRatio = displayedWidth / photoWidth;
    let yRatio = displayedHeight / photoHeight;
    for (let index = 0; index < points.value.length; index++) {
      const point = points.value[index];
      let x = Math.ceil((point.x - widthDiff) / xRatio);
      let y = Math.ceil((point.y - heightDiff) / yRatio);
      x = Math.max(1,x);
      y = Math.max(1,y);
      x = Math.min(x,photoWidth-1);
      y = Math.min(y,photoHeight-1);
      newPoints.push({x:x,y:y});
    }
    return newPoints as [Point,Point,Point,Point];
  };

  const getDisplayedSize = () => {
    let displayedWidth = width;
    let displayedHeight = height;
    if (props.photo!.height / props.photo!.width > height / width) {
      displayedWidth = props.photo!.width * (height / props.photo!.height);
    }else{
      displayedHeight = props.photo!.height * (width / props.photo!.width);
    }
    return {displayedWidth:displayedWidth,displayedHeight:displayedHeight};
  };

  const panGesture = Gesture.Pan()
    .onChange((e) => {
      console.log(points.value);
      let index = selectedIndex;
      if (index !== -1) {
        let newPoints = JSON.parse(JSON.stringify(points.value));
        if (Math.abs(e.changeX) < 5 && Math.abs(e.changeY) < 5) {
          newPoints[index].x = newPoints[index].x + e.changeX;
          newPoints[index].y = newPoints[index].y + e.changeY;
        } 
        points.value = newPoints;
      }
    });

  const tapGesture = Gesture.Tap()
    .onBegin((e) => {
      const selectRect = () => {
        let rectList = [{x:rect1X,y:rect1Y},{x:rect2X,y:rect2Y},{x:rect3X,y:rect3Y},{x:rect4X,y:rect4Y}];
        for (let index = 0; index < 4; index++) {
          const rect = rectList[index];
          let diffX = Math.abs(e.absoluteX - rect.x.value);
          let diffY = Math.abs(e.absoluteY - rect.y.value);
          if (diffX < 35 && diffY < 35) {
            runOnJS(setSelectedIndex)(index);
            break;
          }
        }
      };
      selectRect();
    });

  const composed = Gesture.Simultaneous(tapGesture, panGesture);
  
  const rects = () => {
    let rectList = [{x:rect1X,y:rect1Y},{x:rect2X,y:rect2Y},{x:rect3X,y:rect3Y},{x:rect4X,y:rect4Y}];
    const items = rectList.map((rect,index) =>
      <Rect key={'rect-' + index}  style="stroke" strokeWidth={(index === selectedIndex) ? 6 : 4} x={rect.x} y={rect.y} width={rectWidth} height={rectWidth} color="lightblue" />
    );
    return items;
  };

  return (
    <SafeAreaView 
      style={styles.container}>
      {image != null && (
        <GestureHandlerRootView>
          <GestureDetector gesture={composed}>
            <Canvas style={{ flex: 1 }}>
              <Fill color="white" />
              <Image image={image} fit="contain" x={0} y={0} width={width} height={height} />
              {!detecting && (
                <>
                  <Points
                    points={polygonPoints}
                    mode="polygon"
                    color="lightblue"
                    style="fill"
                    strokeWidth={4}
                  />
                  {rects()}
                </>
              )}
            </Canvas>
          </GestureDetector>
        </GestureHandlerRootView>
      )}
      
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:1,
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
  radioContainer:{
    flex: 0.7,
    padding: 5,
    margin: 3,
  },
  buttonContainer:{
    flex: 0.3,
    padding: 5,
    margin: 3,
  },
  button: {
    backgroundColor: "ghostwhite",
    borderColor:"black", 
    borderWidth:2, 
    borderRadius:5,
    padding: 8,
    margin: 3,
  },
  image: {
    resizeMode:"contain",
  }
});