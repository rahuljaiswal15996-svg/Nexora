import { render, screen, fireEvent } from '@testing-library/react';
import CodeEditor from '../components/CodeEditor';

describe('CodeEditor', () => {
  it('renders with label and value', () => {
    render(<CodeEditor label="Test Label" value="test code" />);
    
    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test code')).toBeInTheDocument();
  });

  it('calls onChange when text is edited', () => {
    const mockOnChange = jest.fn();
    render(<CodeEditor label="Test" value="" onChange={mockOnChange} />);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'new code' } });
    
    expect(mockOnChange).toHaveBeenCalledWith('new code');
  });

  it('is read-only when readOnly is true', () => {
    render(<CodeEditor label="Test" value="readonly code" readOnly />);
    
    const textarea = screen.getByDisplayValue('readonly code');
    expect(textarea).toHaveAttribute('readonly');
  });
});