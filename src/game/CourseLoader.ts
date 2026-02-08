import { CourseData } from '../types';

export class CourseLoader {
  async load(path: string): Promise<CourseData> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load course: ${path}`);
    }

    const data = await response.json();
    this.validate(data);
    return data as CourseData;
  }

  private validate(data: unknown) {
    if (!data || typeof data !== 'object') {
      throw new Error('Course data must be an object');
    }

    const d = data as Record<string, unknown>;

    if (typeof d.name !== 'string') throw new Error('Course must have a name');
    if (typeof d.par !== 'number') throw new Error('Course must have a par');
    if (!d.tee || typeof d.tee !== 'object') throw new Error('Course must have a tee position');
    if (!d.hole || typeof d.hole !== 'object') throw new Error('Course must have a hole position');
    if (!Array.isArray(d.zones)) throw new Error('Course must have zones array');
  }
}
