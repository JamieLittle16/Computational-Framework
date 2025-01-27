import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Define the type for the settings object
interface Settings {
  initialQ: number;
  modBase: number;
  maxEvalDepth: number;
  delay: number;
  selectionTintStrength: number;
  colorMode: boolean;
}
interface LocalValueItem {
  value: number;
  isDefault: boolean;
}
interface LocalValues {
  initialQ: LocalValueItem;
  modBase: LocalValueItem;
  maxEvalDepth: LocalValueItem;
  delay: LocalValueItem;
  selectionTintStrength: LocalValueItem;
}

interface Errors {
  modBase: string;
  maxEvalDepth: string;
  delay: string;
  selectionTintStrength: string;
}

// Settings component
const SettingsPanel: React.FC<{
  settings: Settings;
  onSettingsChange: (settings: Settings | ((prev: Settings) => Settings)) => void;
}> = ({ settings, onSettingsChange }) => {

  const [localValues, setLocalValues] = useState<LocalValues>({
    initialQ: { value: settings.initialQ, isDefault: settings.initialQ === 0 },
    modBase: { value: settings.modBase, isDefault: settings.modBase === 2 },
    maxEvalDepth: { value: settings.maxEvalDepth, isDefault: settings.maxEvalDepth === 100 },
    delay: { value: settings.delay, isDefault: settings.delay === 100 },
    selectionTintStrength: { value: settings.selectionTintStrength, isDefault: settings.selectionTintStrength === 0.15 }
  });
  const [errors, setErrors] = useState<Errors>({
    modBase: '',
    maxEvalDepth: '',
    delay: '',
    selectionTintStrength: ''
  });
  const validateInputs = useMemo(() => {
    const newErrors: Errors = {
      modBase: '',
      maxEvalDepth: '',
      delay: '',
      selectionTintStrength: ''
    };
    if (localValues.modBase.value < 2 || !Number.isInteger(localValues.modBase.value)) {
      newErrors.modBase = 'Mod base must be a positive integer and at least 2';
    }
    if (localValues.maxEvalDepth.value < 1 || !Number.isInteger(localValues.maxEvalDepth.value)) {
      newErrors.maxEvalDepth = 'Max depth must be a positive integer and at least 1';
    }
    if (localValues.delay.value < 0) {
      newErrors.delay = 'Delay must be at least 0'
    }
    if (localValues.selectionTintStrength.value < 0 || localValues.selectionTintStrength.value > 1) {
      newErrors.selectionTintStrength = 'Must be between 0 and 1';
    }

    return newErrors
  }, [localValues]);

  useEffect(() => {
    setErrors(validateInputs);
  }, [validateInputs]);

  const hasErrors = Object.values(errors).some(error => error !== '');

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, id: keyof LocalValues, defaultValue: number) => {
    const rawValue = e.target.value;
    const value = rawValue === "" ? defaultValue : parseFloat(rawValue);
    setLocalValues(prev => ({
      ...prev,
      [id]: { value: isNaN(value) ? defaultValue : value, isDefault: rawValue === "" }
    }));
  }, []);

  const handleBlur = useCallback((id: keyof LocalValues) => {
    if (errors[id as keyof Errors] === '') {
      onSettingsChange(prev => {
        const updatedSettings = {
          ...prev,
          [id]: localValues[id].value
        }
        return updatedSettings
      });
    }
  }, [errors, localValues, onSettingsChange]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="initialQ">Initial Q Value</Label>
        <Input
          id="initialQ"
          type="number"
          placeholder="0"
          value={localValues.initialQ.isDefault ? "" : String(localValues.initialQ.value)}
          onFocus={(e) => {
            if (localValues.initialQ.isDefault) e.target.value = "";
          }}
          onBlur={() => handleBlur("initialQ")}
          onChange={(e) => handleInputChange(e, "initialQ", 0)}
        />
        <p className="text-sm text-gray-500">Default Q value for new nodes</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="modBase">Mod Base</Label>
        <Input
          id="modBase"
          type="number"
          min="2"
          placeholder="2"
          value={localValues.modBase.isDefault ? "" : String(localValues.modBase.value)}
          onFocus={(e) => {
            if (localValues.modBase.isDefault) e.target.value = "";
          }}
          onBlur={() => handleBlur("modBase")}
          onChange={(e) => handleInputChange(e, "modBase", 2)}
        />
        {errors.modBase && <p className="text-sm text-red-500">{errors.modBase}</p>}
        <p className="text-sm text-gray-500">Base for modular arithmetic (minimum 2)</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxEvalDepth">Max Evaluation Depth</Label>
        <Input
          id="maxEvalDepth"
          type="number"
          min="1"
          placeholder="100"
          value={localValues.maxEvalDepth.isDefault ? "" : String(localValues.maxEvalDepth.value)}
          onFocus={(e) => {
            if (localValues.maxEvalDepth.isDefault) e.target.value = "";
          }}
          onBlur={() => handleBlur("maxEvalDepth")}
          onChange={(e) => handleInputChange(e, "maxEvalDepth", 100)}
        />
        {errors.maxEvalDepth && <p className="text-sm text-red-500">{errors.maxEvalDepth}</p>}
        <p className="text-sm text-gray-500">Maximum depth of evaluation to prevent infinite loops</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="delay">Update Delay (ms)</Label>
        <Input
          id="delay"
          type="number"
          min="0"
          placeholder="100"
          value={localValues.delay.isDefault ? "" : String(localValues.delay.value)}
          onFocus={(e) => {
            if (localValues.delay.isDefault) e.target.value = "";
          }}
          onBlur={() => handleBlur("delay")}
          onChange={(e) => handleInputChange(e, "delay", 100)}
        />
        {errors.delay && <p className="text-sm text-red-500">{errors.delay}</p>}
        <p className="text-sm text-gray-500">Delay before node updates in milliseconds.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="selectionTintStrength">Selection Tint Strength</Label>
        <Input
          id="selectionTintStrength"
          type="number"
          min="0"
          max="1"
          step="0.05"
          placeholder="0.15"
          value={localValues.selectionTintStrength.isDefault ? "" : String(localValues.selectionTintStrength.value)}
          onFocus={(e) => {
            if (localValues.selectionTintStrength.isDefault) e.target.value = "";
          }}
          onBlur={() => handleBlur("selectionTintStrength")}
          onChange={(e) => handleInputChange(e, "selectionTintStrength", 0.15)}
        />
        {errors.selectionTintStrength && <p className="text-sm text-red-500">{errors.selectionTintStrength}</p>}
        <p className="text-sm text-gray-500">Strength of the blue tint when node is selected (0 to 1)</p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="colorMode"
          checked={settings.colorMode}
          onCheckedChange={(checked) => onSettingsChange((prev) => ({ ...prev, colorMode: checked as boolean }))}
          disabled={hasErrors}
        />
        <label
          htmlFor="colorMode"
          className="text-sm text-gray-700 cursor-pointer"
        >
          Enable Colour-Coding
        </label>
      </div>
    </div>
  );
};

export default SettingsPanel;
