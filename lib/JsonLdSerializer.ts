import EventEmitter = NodeJS.EventEmitter;
import * as RDF from "rdf-js";
import {PassThrough, Transform, TransformCallback} from "stream";

/**
 * A stream transformer that transforms an {@link RDF.Stream} into a JSON-LD (text) stream.
 */
export class JsonLdSerializer extends Transform {

  private readonly options: IJsonLdSerializerOptions;

  private opened: boolean;
  private lastSubject: RDF.Term;
  private lastPredicate: RDF.Term;
  private hadObjectForPredicate: boolean;

  constructor(options: IJsonLdSerializerOptions = {}) {
    super({ objectMode: true });
    this.options = options;
  }

  /**
   * Parses the given text stream into a quad stream.
   * @param {NodeJS.EventEmitter} stream A text stream.
   * @return {NodeJS.EventEmitter} A quad stream.
   */
  public import(stream: EventEmitter): EventEmitter {
    const output = new PassThrough({ objectMode: true });
    stream.on('error', (error) => parsed.emit('error', error));
    stream.on('data', (data) => output.write(data));
    stream.on('end', () => output.emit('end'));
    const parsed = output.pipe(new JsonLdSerializer(this.options));
    return parsed;
  }

  public _transform(quad: RDF.Quad, encoding: string, callback: TransformCallback): void {
    // Open the array before the first quad
    if (!this.opened) {
      this.opened = true;
      this.push(`[`);
    }

    if (!this.lastSubject || !quad.subject.equals(this.lastSubject)) {
      if (this.lastSubject) {
        // Close the last subject's node (and predicate array)
        this.push(`]},`);

        // Reset predicate buffer
        this.lastPredicate = null;
        this.hadObjectForPredicate = false;
      }

      // Open a new node for the new subject
      this.lastSubject = quad.subject;
      this.push(`{"@id": "${quad.subject.value}",`);
    }

    if (!this.lastPredicate || !quad.predicate.equals(this.lastPredicate)) {
      if (this.lastPredicate) {
        // Close the last predicate's array
        this.push(`],`);
      }

      // Open a new array for the new predicate
      this.lastPredicate = quad.predicate;
      this.hadObjectForPredicate = false;
      this.push(`"${quad.predicate.value}": [`);
    }

    // Write the object value
    this.pushObject(quad.object);

    return callback();
  }

  public _flush(callback: TransformCallback): void {
    // If the stream was empty, ensure that we push the opening array
    if (!this.opened) {
      this.push(`[`);
    }

    if (this.lastPredicate) {
      // Close predicate array
      this.lastPredicate = null;
      this.hadObjectForPredicate = false;
      this.push(`]`);
    }
    if (this.lastSubject) {
      // Close the subject node
      this.lastSubject = null;
      this.push(`}`);
    }

    this.push(`]`);
    return callback(null, null);
  }

  protected pushObject(object: RDF.Term) {
    if (!this.hadObjectForPredicate) {
      this.hadObjectForPredicate = true;
    } else {
      this.push(`,`);
    }
    this.push(`"${object.value}"`);
  }

}

/**
 * Constructor arguments for {@link JsonLdSerializer}
 */
export interface IJsonLdSerializerOptions {

}
