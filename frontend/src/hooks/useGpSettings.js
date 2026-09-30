import { useGpSettingsContext } from '../context/GpSettingsContext';

// जुनी सवय (`const { settings, gpLine } = useGpSettings()`) सर्वत्र तशीच
// राहावी म्हणून हा wrapper ठेवला - प्रत्यक्ष डेटा आता GpSettingsProvider
// मध्ये एकदाच आणला जातो (पहा context/GpSettingsContext.jsx).
export default function useGpSettings() {
  return useGpSettingsContext();
}
