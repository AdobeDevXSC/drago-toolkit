import { expect } from '@esm-bundle/chai';
import {
  areRequiredFieldsComplete,
  getVisibleRequiredControls,
  isRequiredFlag,
  validateSection,
} from '../../blocks/form/form-validation.js';

function buildSection(html) {
  const section = document.createElement('section');
  section.className = 'form-section';
  section.innerHTML = html;
  document.body.append(section);
  return section;
}

describe('form required-field completion', () => {
  /** @type {HTMLElement[]} */
  let sections = [];

  afterEach(() => {
    sections.forEach((section) => section.remove());
    sections = [];
  });

  it('isRequiredFlag accepts string and boolean true', () => {
    expect(isRequiredFlag('true')).to.be.true;
    expect(isRequiredFlag(true)).to.be.true;
    expect(isRequiredFlag('false')).to.be.false;
    expect(isRequiredFlag(false)).to.be.false;
  });

  it('returns incomplete when a required text field is empty', () => {
    const section = buildSection(`
      <div class="form-field text-field">
        <input type="text" name="accountName" required />
      </div>
    `);
    sections.push(section);
    expect(areRequiredFieldsComplete(section)).to.be.false;
  });

  it('returns complete when required fields are filled', () => {
    const section = buildSection(`
      <div class="form-field text-field">
        <input type="text" name="accountName" required value="Acme" />
      </div>
      <div class="form-field select-field">
        <select name="topic" required>
          <option value="general" selected>General</option>
        </select>
      </div>
    `);
    sections.push(section);
    expect(areRequiredFieldsComplete(section)).to.be.true;
  });

  it('excludes hidden required fields from completion check', () => {
    const section = buildSection(`
      <div class="form-field text-field" aria-hidden="true">
        <input type="text" name="hiddenField" required />
      </div>
      <div class="form-field text-field">
        <input type="text" name="visibleField" required value="done" />
      </div>
    `);
    sections.push(section);
    expect(areRequiredFieldsComplete(section)).to.be.true;
    expect(getVisibleRequiredControls(section)).to.have.lengthOf(1);
  });

  it('requires at least one selection in a required multiselect', () => {
    const section = buildSection(`
      <fieldset class="form-field multiselect-field checkbox-field" data-required="true">
        <input type="checkbox" name="deployments" value="On-prem" />
        <input type="checkbox" name="deployments" value="AMS" />
      </fieldset>
    `);
    sections.push(section);
    expect(areRequiredFieldsComplete(section)).to.be.false;

    section.querySelector('input[value="AMS"]').checked = true;
    expect(areRequiredFieldsComplete(section)).to.be.true;
  });

  it('does not block required completion when an optional field is invalid', () => {
    const section = buildSection(`
      <div class="form-field text-field">
        <input type="text" name="requiredField" required value="done" />
      </div>
      <div class="form-field text-field">
        <input type="email" name="optionalEmail" value="not-an-email" />
      </div>
    `);
    sections.push(section);
    expect(areRequiredFieldsComplete(section)).to.be.true;
    expect(validateSection(section)).to.be.false;
  });
});
