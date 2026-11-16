import Input from "../input";
import { DEPARTMENT_TEXT_MAX_LENGTH } from "../ncrConstraints";
import YesNoField from "./YesNoField";
import { countHelp, type SectionProps } from "./formModel";

export default function ProcurementSection({
	values,
	errors,
	update,
	text,
}: SectionProps<"procurement">) {
	return (
		<>
			<Input
				type={Input.PARAGRAPH}
				name="procurementDelayCommunication"
				label="Communication of a delay due to quality rejection (optional)"
				value={values.delayCommunication}
				maxLength={DEPARTMENT_TEXT_MAX_LENGTH}
				placeholder="e.g. The supplier was told the order is on hold until a replacement ships."
				helpText={countHelp(values.delayCommunication.length)}
				error={errors.procurementDelayCommunication}
				onChange={text("delayCommunication")}
			/>
			<YesNoField
				id="procurementReturnRequested"
				legend="Does the supplier want the rejected items back? (optional)"
				value={values.returnRequested}
				onChange={(next: any) => update({ returnRequested: next })}
			/>
			<Input
				type={Input.TEXT}
				name="procurementRmaNumber"
				label="RMA number (optional)"
				value={values.rmaNumber}
				maxLength={50}
				error={errors.procurementRmaNumber}
				onChange={text("rmaNumber")}
			/>
			<Input
				type={Input.TEXT}
				name="procurementCarrierName"
				label="Carrier (optional)"
				value={values.carrierName}
				maxLength={100}
				error={errors.procurementCarrierName}
				onChange={text("carrierName")}
			/>
			<Input
				type={Input.TEXT}
				name="procurementCarrierAccountNumber"
				label="Carrier account number (optional)"
				value={values.carrierAccountNumber}
				maxLength={50}
				error={errors.procurementCarrierAccountNumber}
				onChange={text("carrierAccountNumber")}
			/>
			<YesNoField
				id="procurementDisposeOnSite"
				legend="Dispose of the items on site?"
				value={values.disposeOnSite}
				onChange={(next: any) => update({ disposeOnSite: next })}
			/>
			<Input
				type={Input.TEXT}
				name="procurementReplacementDate"
				label="Replacement expected on (optional)"
				value={values.replacementDate}
				maxLength={10}
				placeholder="YYYY-MM-DD"
				error={errors.procurementReplacementDate}
				onChange={text("replacementDate")}
			/>
			<YesNoField
				id="procurementSapReturnCompleted"
				legend="SAP return completed?"
				value={values.sapReturnCompleted}
				onChange={(next: any) => update({ sapReturnCompleted: next })}
			/>
			<YesNoField
				id="procurementCreditExpected"
				legend="Credit expected?"
				value={values.creditExpected}
				onChange={(next: any) => update({ creditExpected: next })}
			/>
			<YesNoField
				id="procurementBillSupplier"
				legend="Bill the supplier?"
				value={values.billSupplier}
				onChange={(next: any) => update({ billSupplier: next })}
			/>
		</>
	);
}