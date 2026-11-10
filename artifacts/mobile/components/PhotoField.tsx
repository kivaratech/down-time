import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import Colors from "@/constants/colors";

export type PickedPhoto = {
  uri: string;
  // Pixel width of the original, used to decide whether to downscale before upload.
  width: number;
};

type Props = {
  photoUri: string | null;
  onChange: (photo: PickedPhoto | null) => void;
};

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.8,
  allowsEditing: false,
};

/**
 * The optional photo attachment on the report forms. Offers two sources on
 * phones/tablets — the camera and the device's photo library — and shows a
 * preview with remove / replace actions once a photo is chosen.
 *
 * On web there is no camera capture, so a single "Attach Photo" button opens
 * the browser's file picker.
 */
export default function PhotoField({ photoUri, onChange }: Props) {
  const [notice, setNotice] = useState("");
  const isWeb = Platform.OS === "web";

  function accept(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    onChange({ uri: asset.uri, width: asset.width ?? 0 });
  }

  async function chooseFromLibrary() {
    await Haptics.selectionAsync();
    setNotice("");
    try {
      // No permission prompt needed: the system photo picker (iOS 14+,
      // Android 13+) only hands the app the one photo the person picks.
      accept(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
    } catch {
      setNotice("Couldn't open the photo library. Please try again.");
    }
  }

  async function takePhoto() {
    await Haptics.selectionAsync();
    setNotice("");
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        setNotice(
          "Camera access is turned off for DownTime. Turn it on in Settings, or choose a photo from the library instead.",
        );
        return;
      }
      accept(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
    } catch {
      setNotice("Couldn't open the camera. You can choose a photo from the library instead.");
    }
  }

  function removePhoto() {
    setNotice("");
    onChange(null);
  }

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>Photo (optional)</Text>

      {photoUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photoUri }} style={styles.preview} />
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={removePhoto}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
          >
            <Feather name="x-circle" size={22} color={Colors.accent} />
          </TouchableOpacity>
          <View style={styles.replaceRow}>
            {isWeb ? (
              <TouchableOpacity style={styles.replaceBtn} onPress={chooseFromLibrary}>
                <Feather name="refresh-cw" size={14} color={Colors.textSecondary} />
                <Text style={styles.replaceBtnText}>Change photo</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={styles.replaceBtn} onPress={takePhoto}>
                  <Feather name="camera" size={14} color={Colors.textSecondary} />
                  <Text style={styles.replaceBtnText}>Retake</Text>
                </TouchableOpacity>
                <View style={styles.replaceDivider} />
                <TouchableOpacity style={styles.replaceBtn} onPress={chooseFromLibrary}>
                  <Feather name="image" size={14} color={Colors.textSecondary} />
                  <Text style={styles.replaceBtnText}>Choose another</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ) : isWeb ? (
        <TouchableOpacity style={styles.sourceBtn} onPress={chooseFromLibrary} activeOpacity={0.8}>
          <Feather name="camera" size={20} color={Colors.primary} />
          <Text style={styles.sourceBtnText}>Attach Photo</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.sourceRow}>
          <TouchableOpacity
            style={[styles.sourceBtn, styles.sourceBtnHalf]}
            onPress={takePhoto}
            activeOpacity={0.8}
          >
            <Feather name="camera" size={20} color={Colors.primary} />
            <Text style={styles.sourceBtnText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sourceBtn, styles.sourceBtnHalf]}
            onPress={chooseFromLibrary}
            activeOpacity={0.8}
          >
            <Feather name="image" size={20} color={Colors.primary} />
            <Text style={styles.sourceBtnText}>Upload Photo</Text>
          </TouchableOpacity>
        </View>
      )}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  sourceRow: {
    flexDirection: "row",
    gap: 10,
  },
  sourceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    gap: 10,
  },
  sourceBtnHalf: {
    flex: 1,
  },
  sourceBtnText: {
    fontSize: 15,
    color: Colors.primary,
    fontFamily: "Inter_500Medium",
  },
  previewContainer: {
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  preview: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },
  replaceRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: Colors.surface,
  },
  replaceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  replaceDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
  },
  replaceBtnText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  notice: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
