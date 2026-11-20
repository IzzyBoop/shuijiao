import { useState } from 'preact/hooks';
import { downloadNoto, notoChosen, NOTO_SIZE_MB, removeNoto } from '../../core/theme/ink-font';
import { problemFrom, ProblemNotice, type Problem } from '../../core/ui/problem';
import { SettingRow } from '../../core/ui/SettingRow';

/**
 * 墨 Ink only: Chinese in the device's own serif (no download), or in Noto Serif TC, which
 * the student can download here (it says how big it is first) and remove again.
 */
export function InkFontRow() {
  const [noto, setNoto] = useState(() => notoChosen());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  const download = async () => {
    setProblem(null);
    try {
      await downloadNoto((done, total) => {
        setProgress({ done, total });
      });
      setNoto(true);
    } catch (err) {
      setProblem(problemFrom(err, 'Downloading the Noto Serif TC font'));
    } finally {
      setProgress(null);
    }
  };

  const remove = async () => {
    setProblem(null);
    try {
      await removeNoto();
      setNoto(false);
    } catch (err) {
      setProblem(problemFrom(err, 'Removing the Noto Serif TC font'));
    }
  };

  return (
    <SettingRow
      id="set-ink-font"
      label="Chinese font"
      hint={
        noto
          ? 'Noto Serif TC is downloaded, so characters look the same on every device, also offline.'
          : `Your device's own serif font. Download Noto Serif TC (${NOTO_SIZE_MB} MB) to have the same characters on every device; it then works offline.`
      }
      wide
    >
      <div class="stack-tight">
        {progress ? (
          <span class="small" role="status">
            Downloading… {Math.round((progress.done / progress.total) * 100)}%
          </span>
        ) : noto ? (
          <button type="button" onClick={() => void remove()}>
            Use my device's font
          </button>
        ) : (
          <button type="button" onClick={() => void download()}>
            Download Noto Serif TC ({NOTO_SIZE_MB} MB)
          </button>
        )}
        {problem && <ProblemNotice problem={problem} />}
      </div>
    </SettingRow>
  );
}
