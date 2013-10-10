#!/usr/bin/python
import subprocess
import json
import simplejson
import sys
import operator
import time
from optparse import OptionParser
from msc_utils import *

d=False # debug_mode

def main():
    parser = OptionParser("usage: %prog [options]")
    parser.add_option("-d", "--debug", action="store_true",dest='debug_mode', default=False,
                        help="turn debug mode on")
    parser.add_option("-t", "--transaction",dest='single_tx',default=None,
                        help="hash of a specific tx to parse")
    parser.add_option("-s", "--start-block",dest='starting_block_height',default=None,
                        help="start the parsing at a higher block height")

    (options, args) = parser.parse_args()
    d=options.debug_mode
    single_tx=options.single_tx
    starting_block_height=options.starting_block_height

    if single_tx == None:
        # get all tx of exodus address
        history=get_history(exodus_address)
        history.sort(key=output_height)
    else:
        # build fake history of length 1 (debug purposes)
        json_tx=get_json_tx(get_raw_tx(single_tx))
        marker_number=-1
        marker_value=-1
        i=0
        for o in json_tx['outputs']:
            if o['address']==exodus_address:
                marker_number=i
                marker_value=o['value']
                # FIXME: handle multiple outputs to 1EXoDus
                break
            else:
                i+=1
        if marker_number == -1:
            error('tx does not belong to exodus')

        t1={"output": single_tx+':'+str(marker_number),
        "output_height":"0",
        "value":  str(marker_value)}
        history=[]
        history.append(t1)

    # go over transaction from all history of 1EXoDus address
    for tx_dict in history:
        value=tx_dict['value']
        if starting_block_height != None:
            current_block=tx_dict['output_height']
            if int(current_block)<int(starting_block_height):
                debug(d,'skip block '+str(current_block)+' since starting at '+str(starting_block_height))
                continue
        try:
            tx_hash=tx_dict['output'].split(':')[0]
            tx_output_index=tx_dict['output'].split(':')[1]
        except KeyError, IndexError:
            error("Cannot parse tx_dict:" + str(tx_dict))
        raw_tx=get_raw_tx(tx_hash)
        json_tx=get_json_tx(raw_tx, tx_hash)
	(block,index)=get_tx_index(tx_hash)
        # examine the outputs
        outputs_list=json_tx['outputs']
        # if we're here, then 1EXoDus is within the outputs. Remove it, but ...
        outputs_list_no_exodus=[]
        outputs_to_exodus=[]
        different_outputs_values={}
        for o in outputs_list:
            if o['address']!=exodus_address:
                outputs_list_no_exodus.append(o)
            else:
                outputs_to_exodus.append(o)
            output_value=o['value']
            if different_outputs_values.has_key(output_value):
                different_outputs_values[output_value]+=1
            else:
                different_outputs_values[output_value]=1
        # take care if multiple 1EXoDus exist (for the case that someone sends msc
        # to 1EXoDus, or have 1EXoDus as change address)
        if len(outputs_to_exodus) != 1:
            # add all but the marker outputs
            info("not implemented tx with multiple 1EXoDus outputs: "+tx_hash)
            continue
        num_of_outputs=len(outputs_list)
        block_timestamp=get_block_timestamp(int(block))

        # check if basic or multisig
        is_basic=True
        for o in outputs_list:
            if is_script_multisig(o['script']):
                debug(d,'multisig tx found: '+tx_hash)
                is_basic=False
                break

        if is_basic: # basic option - not multisig
            if num_of_outputs > 2: # for reference, data, marker
                parsed=parse_simple_basic(raw_tx, tx_hash)
                parsed['method']='basic'
                parsed['block']=str(block)
                parsed['index']=str(index)
                if not parsed.has_key('invalid'):
                    parsed['invalid']=False
                parsed['tx_time']=format_time_from_epoch(block_timestamp)
                filename='tx/'+parsed['tx_hash']+'.json'
                orig_json=None
                try:
                    # does this tx exist? (from bootstrap)
                    f=open(filename, 'r')
                    orig_json=json.load(f)
                    f.close()
                except:
                    pass
                try:
                    f=open(filename, 'w')
                    if orig_json != None: # it was an exodus tx
                        if len(orig_json)==1:
                            new_json=[orig_json[0],parsed]
                            json.dump(new_json, f)
                            f.write('\n')
                            info('basic tx was also exodus on '+tx_hash)
                        else:
                            info('basic tx is already present on exodus on '+tx_hash)
                    else:
                        f.write('[')
                        json.dump(parsed, f)
                        f.write(']\n')
                    f.close()
                except IndexError, OSError:
                    info("json dump failed for "+tx_hash)
            else: # num_of_outputs <= 2 and not multisig
                debug(d,'not parsing basic tx with less than 3 outputs '+tx_hash)
        else: # multisig
            if num_of_outputs == 2: # simple version of multisig
                parsed=parse_multisig_simple(raw_tx, tx_hash)
                parsed['method']='multisig'
                parsed['block']=str(block)
                parsed['index']=str(index)
                if not parsed.has_key('invalid'):
                    parsed['invalid']=False
                parsed['tx_time']=format_time_from_epoch(block_timestamp)
                filename='tx/'+parsed['tx_hash']+'.json'
                try:
                    f=open(filename, 'w')
                    f.write('[')
                    json.dump(parsed, f)
                    f.write(']\n')
                    f.close()
                except OSError:
                    info("json dump failed for "+tx_hash)
                    pass
            else:
                if num_of_outputs > 2: # multisig long
                    info(parse_multisig_long(raw_tx))
                else: # invalid
                    info('multisig with a single output tx found: '+tx_hash)
    rev=get_revision_dict()
    f=open('www/revision.json','w')
    json.dump(rev, f)
    f.close()

if __name__ == "__main__":
    main()
