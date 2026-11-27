/**
 * Claim evidence (ruling 69): links, and photos from the gallery or the
 * camera. Until the server exists nothing is uploaded: a photo is copied into
 * the app's documents folder (the picker's own copy lives in a cache the
 * system may clear) and the claim stores that local reference.
 */
import { useState } from "react";
import { Image, Platform, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Directory, File, Paths } from "expo-file-system";
import type { ClaimEvidence } from "@cultivation/schema";
import { Button, C, Field, Note, Row, T } from "./ui";

/** The schema's limits: at most 10 references, each at most 2,048 characters. */
export const MAX_EVIDENCE = 10;
const MAX_REF = 2048;

/** Copies a picked photo into documents/evidence and returns its URI; on web (no file system) a short name stands in. */
function keepPhoto(asset: ImagePicker.ImagePickerAsset): string {
  if (Platform.OS === "web") {
    return asset.uri.length <= MAX_REF ? asset.uri : `web-photo:${asset.fileName ?? "photo"}`;
  }
  const dir = new Directory(Paths.document, "evidence");
  dir.create({ idempotent: true, intermediates: true });
  const ext = (asset.fileName ?? asset.uri).match(/\.[a-z0-9]+$/i)?.[0] ?? ".jpg";
  const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  new File(asset.uri).copy(dest);
  return dest.uri;
}

export function EvidencePicker({ value, onChange }: { value: ClaimEvidence[]; onChange: (v: ClaimEvidence[]) => void }) {
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const full = value.length >= MAX_EVIDENCE;

  const addLink = () => {
    const ref = link.trim();
    if (!/^https?:\/\/\S+$/i.test(ref)) {
      setError("A link starts with http:// or https://.");
      return;
    }
    setError(null);
    onChange([...value, { kind: "link", ref: ref.slice(0, MAX_REF) }]);
    setLink("");
  };

  const addPhotos = async (source: "gallery" | "camera") => {
    setError(null);
    try {
      const perm = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(source === "camera" ? "Camera access was not allowed." : "Photo access was not allowed.");
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: "images", quality: 0.8 };
      const r =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: MAX_EVIDENCE - value.length });
      if (r.canceled) return;
      const added = r.assets.slice(0, MAX_EVIDENCE - value.length).map((a): ClaimEvidence => ({ kind: "photo", ref: keepPhoto(a) }));
      onChange([...value, ...added]);
    } catch (e) {
      setError(`Couldn't add the photo: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <T muted>{`Evidence (optional, up to ${MAX_EVIDENCE}): links and photos. Photos stay on this phone for now; nothing is uploaded.`}</T>
      {value.map((ev, i) => (
        <Row key={`${ev.ref}-${i}`}>
          {ev.kind === "photo" && !ev.ref.startsWith("web-photo:") ? <Image source={{ uri: ev.ref }} style={{ width: 48, height: 48, borderRadius: 6 }} /> : null}
          <T style={{ flex: 1, color: C.text }}>
            {ev.kind === "link" ? ev.ref : `Photo ${value.slice(0, i + 1).filter((x) => x.kind === "photo").length}`}
          </T>
          <Button label="Remove" kind="ghost" onPress={() => onChange(value.filter((_, j) => j !== i))} />
        </Row>
      ))}
      {full ? null : (
        <>
          <Row>
            <View style={{ flex: 1 }}>
              <Field label="Evidence link" value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" maxLength={500} />
            </View>
            <Button label="Add link" kind="ghost" onPress={addLink} disabled={!link.trim()} />
          </Row>
          <Row>
            <Button label="Photo from gallery" kind="ghost" onPress={() => void addPhotos("gallery")} />
            {Platform.OS === "web" ? null : <Button label="Take a photo" kind="ghost" onPress={() => void addPhotos("camera")} />}
          </Row>
        </>
      )}
      <Note text={error} error />
    </View>
  );
}
