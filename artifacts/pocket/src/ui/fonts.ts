// COMPONENTS §1: Geist for words (400/500/600), Manrope for every digit (400–700; a digit
// takes the weight of the text around it). Static files, one per weight: Android picks a
// custom font by family name, not by fontWeight.
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";

export const fontFiles = {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
};

export type Weight = 400 | 500 | 600 | 700;

export function geist(w: Weight): string {
  return w >= 600 ? "Geist_600SemiBold" : w === 500 ? "Geist_500Medium" : "Geist_400Regular";
}

export function manrope(w: Weight): string {
  return w === 700 ? "Manrope_700Bold" : w === 600 ? "Manrope_600SemiBold" : w === 500 ? "Manrope_500Medium" : "Manrope_400Regular";
}
