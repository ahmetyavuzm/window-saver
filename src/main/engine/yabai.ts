import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const YABAI_MISSING_MESSAGE =
  'yabai bulunamadı. Space (masaüstü) desteği için yabai kurulu ve çalışır olmalı: ' +
  '"brew install yabai" (veya kullandığınız fork), ardından "yabai --start-service" ve ' +
  'Sistem Ayarları > Gizlilik ve Güvenlik > Erişilebilirlik izni gerekli.';

interface YabaiSpace {
  index: number;
}

async function runYabai(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('yabai', ['-m', ...args]);
  return stdout.trim();
}

export async function isYabaiAvailable(): Promise<boolean> {
  try {
    await execFileAsync('yabai', ['-v']);
    return true;
  } catch {
    return false;
  }
}

export async function getSpaceCount(): Promise<number> {
  const stdout = await runYabai(['query', '--spaces']);
  const spaces = JSON.parse(stdout) as YabaiSpace[];
  return spaces.reduce((max, space) => Math.max(max, space.index), 0);
}

export async function ensureSpaceCount(targetIndex: number): Promise<void> {
  let count = await getSpaceCount();
  while (count < targetIndex) {
    try {
      await runYabai(['space', '--create']);
    } catch {
      throw new Error(
        `Space ${targetIndex} mevcut değil (şu an ${count} Space var) ve otomatik oluşturulamadı. ` +
          'Yeni Space oluşturmak yabai\'nin "scripting-addition" özelliğini gerektiriyor, bu da SIP\'in ' +
          'kısmen kapatılmasını ister. Bunun yerine Mission Control\'den (Ctrl+Yukarı Ok) elle yeterli sayıda ' +
          'masaüstü oluşturup mevcut bir Space numarasını kullanabilirsiniz.',
      );
    }
    count += 1;
  }
}

function isBenignYabaiNoop(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already focused|already on this space/i.test(message);
}

export async function moveFocusedWindowToSpace(spaceIndex: number): Promise<void> {
  try {
    await runYabai(['window', '--space', String(spaceIndex)]);
  } catch (error) {
    if (!isBenignYabaiNoop(error)) throw error;
  }
  try {
    await runYabai(['space', '--focus', String(spaceIndex)]);
  } catch (error) {
    if (!isBenignYabaiNoop(error)) throw error;
  }
}

export { YABAI_MISSING_MESSAGE };
