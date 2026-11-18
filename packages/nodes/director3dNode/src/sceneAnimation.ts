import { z } from "@toonflow/nodes-scaffold/runtime";
import { AnimationClip, AnimationMixer, Euler, LoopOnce, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from "three";
import { getObjectByThreeJsonId, type SceneRuntime } from "threejson/core";
import { sceneSchema, updateSunShadow } from "./scene";
import { cameraFramesSchema } from "./motion";
import { mannequinJoints } from "./mannequin";

const vector = sceneSchema.shape.objectList.element.shape.position;
export const directorPlanSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  duration: z.number().min(0.2).max(300),
  tracks: z.array(z.strictObject({
    objectId: z.string().trim().min(1).max(100),
    joint: z.enum(mannequinJoints).describe("Chỉ điền khi tạo hoạt ảnh khớp của hình nhân; để trống để điều khiển toàn bộ đối tượng").optional(),
    frames: z.array(z.strictObject({
      time: z.number().min(0).max(300),
      position: vector.optional(),
      rotation: vector.describe("Góc Euler XYZ, đơn vị radian"),
      scale: vector.optional(),
    })).min(2).max(120),
  })).max(200),
  cameraFrames: cameraFramesSchema,
}).superRefine((value, context) => {
  // 最后一个镜头保持到结束，无需重复添加结束帧；单帧表示固定镜头。
  if (value.cameraFrames[0]?.time !== 0 || value.cameraFrames.some(frame => frame.time > value.duration)) {
    context.addIssue({ code: "custom", path: ["cameraFrames"], message: "Thời gian góc máy phải bắt đầu từ 0 và không vượt thời lượng phương án" });
  }
  const trackIds = new Set<string>();
  let frameCount = 0;
  value.tracks.forEach((track, index) => {
    const key = JSON.stringify([track.objectId, track.joint]);
    if (trackIds.has(key)) {
      context.addIssue({ code: "custom", path: ["tracks", index, "objectId"], message: "Mỗi đối tượng hoặc khớp chỉ được có một track" });
    }
    trackIds.add(key);
    if (track.joint && track.frames.some(frame => frame.position || frame.scale)) {
      context.addIssue({ code: "custom", path: ["tracks", index, "frames"], message: "Hoạt ảnh khớp chỉ được đặt rotation; vị trí và tỷ lệ do bộ xương cố định" });
    }
    frameCount += track.frames.length;
    if (track.frames[0]?.time !== 0 || track.frames.some((frame, frameIndex) => frame.time > value.duration || (frameIndex > 0 && frame.time <= track.frames[frameIndex - 1]!.time))) {
      context.addIssue({ code: "custom", path: ["tracks", index, "frames"], message: "Thời gian keyframe phải bắt đầu từ 0, tăng nghiêm ngặt và không vượt thời lượng cảnh" });
    }
  });
  if (frameCount > 2000) context.addIssue({ code: "custom", path: ["tracks"], message: "Hoạt ảnh của cảnh được có tối đa 2.000 keyframe" });
});
export type DirectorPlan = z.infer<typeof directorPlanSchema>;
export type DirectorPlanItem = DirectorPlan & { id: string; instruction?: string };
export type DirectorGeneration = { id: string; instruction: string; error?: string };

export function prepareSceneAnimation(runtime: SceneRuntime, value: DirectorPlan) {
  const { name, duration, tracks: sourceTracks, cameraFrames } = value;
  const animation = directorPlanSchema.parse({ name, duration, tracks: sourceTracks, cameraFrames });
  const tracks = animation.tracks.flatMap(track => {
    const root = getObjectByThreeJsonId(track.objectId, runtime.scene);
    if (!root) throw new Error(`Không tìm thấy đối tượng hoạt ảnh trong cảnh: ${track.objectId}`);
    if (track.joint && root.userData.objJson?.objType !== "mannequin") throw new Error(`Chỉ hình nhân hỗ trợ hoạt ảnh khớp: ${track.objectId}`);
    const object = track.joint ? root.getObjectByName(track.joint) : root;
    if (!object) throw new Error(`Không tìm thấy khớp hình nhân trong cảnh: ${track.joint}`);
    const times = track.frames.map(frame => frame.time);
    return [
      new QuaternionKeyframeTrack(`${object.uuid}.quaternion`, times, track.frames.flatMap(frame => new Quaternion().setFromEuler(new Euler(frame.rotation.x, frame.rotation.y, frame.rotation.z)).toArray())),
      ...(["position", "scale"] as const).filter(property => track.frames.some(frame => frame[property])).map(property =>
        new VectorKeyframeTrack(`${object.uuid}.${property}`, times, track.frames.flatMap(frame => {
          const value = frame[property] ?? object[property];
          return [value.x, value.y, value.z];
        })),
      ),
    ];
  });
  const mixer = new AnimationMixer(runtime.scene);
  const clip = new AnimationClip(animation.name, animation.duration, tracks);
  const action = mixer.clipAction(clip).setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  return {
    setTime(time: number) {
      if (!Number.isFinite(time)) throw new Error("Thời gian hoạt ảnh của cảnh không hợp lệ");
      // LoopOnce 到终点会自动暂停；再次定位到任意时间前恢复采样。
      action.paused = false;
      mixer.setTime(Math.min(animation.duration, Math.max(0, time)));
      updateSunShadow(runtime);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(runtime.scene);
    },
  };
}
