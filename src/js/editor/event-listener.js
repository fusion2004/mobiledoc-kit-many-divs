import assert from 'mobiledoc-kit/utils/assert';
import {
  parsePostFromPaste,
  setClipboardCopyData
} from '../utils/paste-utils';
import Range from 'mobiledoc-kit/utils/cursor/range';
import { filter, forEach, contains } from 'mobiledoc-kit/utils/array-utils';
import Key from 'mobiledoc-kit/utils/key';
// FIXME ? import { TAB } from 'mobiledoc-kit/utils/characters';
import { DIRECTION } from 'mobiledoc-kit/utils/key';
import Logger from 'mobiledoc-kit/utils/logger';
let log = Logger.for('event-listener');

const ELEMENT_EVENT_TYPES = ['keydown', 'keyup', 'cut', 'copy', 'paste', 'keypress'];
const DOCUMENT_EVENT_TYPES = ['mouseup'];

export default class EventListener {
  constructor(editor) {
    this.editor = editor;
    this._listeners = [];
  }

  init() {
    let { editor: { element } } = this;
    assert(`Cannot init EventListener without element`, !!element);

    ELEMENT_EVENT_TYPES.forEach(type => {
      this._addListener(element, type);
    });

    DOCUMENT_EVENT_TYPES.forEach(type => {
      this._addListener(document, type);
    });
  }

  _addListener(context, type) {
    assert(`Missing listener for ${type}`, !!this[type]);

    let listener = (event) => this._handleEvent(type, event);
    context.addEventListener(type, listener);
    this._listeners.push([context, type, listener]);
  }

  _removeListeners() {
    this._listeners.forEach(([context, type, listener]) => {
      context.removeEventListener(type, listener);
    });
  }

  // This is primarily useful for programmatically simulating events on the
  // editor from the tests.
  _trigger(context, type, event) {
    forEach(
      filter(this._listeners, ([_context, _type]) => {
        return _context === context && _type === type;
      }),
      ([context, type, listener]) => {
        listener.call(context, event);
      }
    );
  }

  destroy() {
    this._removeListeners();
    this._listeners = [];
  }

  _handleEvent(type, event) {
    let { editor } = this;

    if (contains(ELEMENT_EVENT_TYPES, type)) {
      let {target: element} = event;
      if (!editor.cursor.isAddressable(element)) {
        // abort handling this event
        return true;
      }
    }

    this[type](event);
  }

  keypress(event) {
    let key = Key.fromEvent(event);
    if (!key.isPrintable()) {
      return;
    }

    event.preventDefault();

    let { editor } = this;
    if (editor.handleExpansion(event)) {
      return;
    } else {
      log(`keypress: inserting text: ${key.toString()}`);
      editor.insertText(key.toString());
    }
  }

  keydown(event) {
    let { editor } = this;
    if (!editor.isEditable || editor.handleKeyCommand(event)) {
      return;
    }

    if (editor.post.isBlank) {
      editor._insertEmptyMarkupSectionAtCursor();
    }

    let key = Key.fromEvent(event);
    let range, nextPosition;

    switch(true) {
      case key.isHorizontalArrow():
        log('keydown: horizontal arrow');
        range = editor.cursor.offsets;
        let position = range.tail;
        if (range.direction === DIRECTION.BACKWARD) {
          position = range.head;
        }
        nextPosition = position.move(key.direction);
        if (
          position.section.isCardSection ||
          (position.marker && position.marker.isAtom) ||
          (nextPosition && nextPosition.marker && nextPosition.marker.isAtom)
        ) {
          if (nextPosition) {
            let newRange;
            if (key.isShift()) {
              newRange = range.moveFocusedPosition(key.direction);
            } else {
              newRange = new Range(nextPosition);
            }
            editor.selectRange(newRange);
            event.preventDefault();
          }
        }
        break;
      case key.isDelete():
        log('keydown: delete');
        editor.handleDeletion(event);
        event.preventDefault();
        break;
      case key.isEnter():
        editor.handleNewline(event);
        break;
    }
  }

  keyup(/* event */) {
    this.editor._reportSelectionState();
  }

  cut(event) {
    this.copy(event);
    this.editor.handleDeletion();
  }

  copy(event) {
    event.preventDefault();
    setClipboardCopyData(event, this.editor);
  }

  paste(event) {
    event.preventDefault();

    let { editor } = this;
    let range = editor.range;

    if (range.head.section.isCardSection) {
      return;
    }
    if (!range.isCollapsed) {
      editor.handleDeletion();
    }
    let position = editor.range.head;
    let pastedPost = parsePostFromPaste(event, editor.builder, editor._parserPlugins);

    editor.run(postEditor => {
      let nextPosition = postEditor.insertPost(position, pastedPost);
      postEditor.setRange(new Range(nextPosition));
    });
  }

  mouseup(/* event */) {
    // mouseup does not correctly report a selection until the next tick
    setTimeout(() => this.editor._reportSelectionState(), 0);
  }
}
