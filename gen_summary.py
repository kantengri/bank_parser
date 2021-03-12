import sys, os, re, datetime, json
from utils import read_transactions, read_alfa, named_dict
import argparse, logging
from collections import namedtuple, defaultdict
from typing import List, DefaultDict, Dict, Union
# from mypy_extensions import TypedDict
from tabulate import tabulate
import numpy as np
import xlsxwriter
import itertools

class _uni_t:
    def __init__(self):
        self.account = None
        self.date = None
        self.amount = None
        self.currency = None
        self.category = None
        self.src = None

uni_t : _uni_t = named_dict('uni_t', ['account', 'date', 'amount', 'currency', 'category', 'src'])

class float_and_list_t(dict):
    def __init__(self, v=0., trs=[]):
        self.v : float = v
        self.trs : List[uni_t] = trs
        super().__init__(self.__dict__)

    def __add__(self, o):
        return float_and_list_t(self.v + o.v, self.trs + o.trs)

class Main:
    @staticmethod
    def make_parser():
        parser = argparse.ArgumentParser()
        parser.add_argument('csvdir')
        parser.add_argument('--debug', action='store_true')
        parser.add_argument('--days_after', type=int)
        parser.add_argument('--days_before', type=int)
        parser.add_argument('--after',  type=lambda s: datetime.datetime.strptime(s, '%d.%m.%Y'))        
        parser.add_argument('--before', type=lambda s: datetime.datetime.strptime(s, '%d.%m.%Y'))        
        parser.add_argument('--allout', default="transactions.json")
        parser.add_argument('--sumout', default="summary.json")
        parser.add_argument('--bydayout', default="expenses_by_day.json")

        return parser

    def  __init__(self, args):
        self.args = args
        self.logger = logging.getLogger(self.__class__.__name__)

    def read_datadir(self):
        for f in os.listdir(self.args.csvdir):
            if f.endswith('.csv'):
                try:
                    fullpath = os.path.join(self.args.csvdir,f)
                    if 'rub' in f:
                        trs = read_alfa(fullpath)
                        yield 'rub', trs
                    elif 'credit' in f:
                        trs = read_alfa(fullpath)
                        yield 'credit', trs
                    elif 'byn' in f:
                        trs = read_transactions(fullpath)
                        yield 'byn', trs
                    elif 'usd' in f:
                        trs = read_transactions(fullpath)
                        yield 'usd', trs
                    else:
                        self.logger.warning(f"{fullpath} is not recognized")
                except Exception:
                    self.logger.exception(fullpath)
                    raise

    def to_unified_rec(self, en):
        for _type, trs in en:
            #['date', 'amount', 'currency', 'category', 'src']
            for tr in trs:
                if _type in ['rub', 'credit']:
                    cat = tr.category
                else:
                    cat = tr.op + tr.category
                _tr = uni_t(_type, tr.date, tr.amount, tr.currency, cat, tr)
                cat = self.get_category(_tr)
                tr = uni_t(_type, tr.date, tr.amount, tr.currency, cat, tr)
                yield tr

    def filter_by_date(self, en : List[_uni_t]):
        min_date = None
        max_date = None
        if self.args.days_after is not None:
            min_date = datetime.datetime.today() - datetime.timedelta(days=self.args.days_after)
        if self.args.after is not None:
            min_date = self.args.after

        if self.args.days_before is not None:
            max_date = datetime.datetime.today() - datetime.timedelta(days=self.args.days_before)
        if self.args.before is not None:
            max_date = self.args.before

        if min_date is not None:
            self.logger.info(f"min_date {min_date}")
        if max_date is not None:
            self.logger.info(f"max_date {max_date}")

        for tr in en:
            if min_date is not None:
                if tr.date <= min_date:
                    continue
            if max_date is not None:
                if tr.date >= max_date:
                    continue
            yield tr

    def filter_transfers(self, en):
        for tr in en:
            if tr.category not in ['income','to BYN', 'to RUB', 'to CREDIT']:
                yield tr

    def get_category(self, tr : _uni_t):

        if tr.amount > 0:
            return 'income'

        cat_defs = {
            'sadik' : [r'Парфенов\s+Сергей'],
            'kv' : [r'в пользу"ЧЕЛЯБИНВЕСТБАНК"'],
            'kv_otop' : [r'RU GOROD74.RU'],
            'cash' : [r'Alfa Iss'],
            'dolina' : [r'DOLINA'],
            'molnia' : [r'MOLNIA'],
            'taxi' : [r'TAXI'],
            'eats' : [r'MAGNIT', r'PYATEROCHKA',r'Магазины продуктовые'],
            'to KATE' : [r'на \+79511286005'],
            'gas' : [r'GAZPROMNEFT',r'AZS', r'АЗС'],
            'to RUB' : [r'CH Debit BLR MINSK P2P_SDBO_INTERNATIONAL'],
            'to BYN' : [r'CH Debit BLR MINSK P2P SDBO NO FEE'],
            'to CREDIT' : [r'Внутрибанковский перевод между счетами'],            
            'Kate eats' : [r'STOLOVAYA VILKA', r'Ресторация'],
        }

        for cat, regs in cat_defs.items():
            for reg in regs:
                # print(reg)
                ret = re.search(reg, tr.category)
                # print(ret, tr.category == ss)
                if ret:
                    return cat
        return 'other'

    def group_by_category(self, en : List[_uni_t]):
        # ValueOrlistDict = TypedDict('ValueOrlistDict', {
        #         'v'   : float,
        #         'trs' : List[uni_t]
        #     })

        summary : DefaultDict[str,DefaultDict[str, DefaultDict[str, float_and_list_t]]] = \
            defaultdict(lambda: defaultdict(lambda: defaultdict(float_and_list_t)))

        for tr in en:
            summary[tr.category][tr.account][tr.currency] += float_and_list_t(tr.amount, [tr])

        cat_totals : DefaultDict[str,DefaultDict[str,float_and_list_t]] = defaultdict(lambda: defaultdict(float_and_list_t))
        acc_totals : DefaultDict[str,DefaultDict[str,float_and_list_t]] = defaultdict(lambda: defaultdict(float_and_list_t))
        spent_total : DefaultDict[str,float_and_list_t] = defaultdict(float_and_list_t)

        for tr in self.filter_transfers(en):
            cat_totals[tr.category][tr.currency] += float_and_list_t(tr.amount, [tr])
            acc_totals[tr.account][tr.currency] += float_and_list_t(tr.amount, [tr])
            spent_total[tr.currency] += float_and_list_t(tr.amount, [tr])

        return {
            'summary' : summary, 
            'cat_totals' : cat_totals, 
            'acc_totals' : acc_totals, 
            'spent_total' : spent_total
            }

    def printable_summary(self, by_cat, printable=True):
        by_acc_cur = {
            cat : {
                f"{acc}_{cur}" : f"{v.v:6.2f}" for acc, curd in accd.items() for cur, v in curd.items()
            } for cat, accd in by_cat['summary'].items()
        }
        for cat, curd in by_cat['cat_totals'].items():
            by_acc_cur[cat]['total'] = ",".join([f"{v.v:6.2f} {cur}" for cur, v in curd.items() ])

        total_by_acc = {f"{acc}_{cur}" : f"{v.v:6.2f}" for acc, accd in by_cat['acc_totals'].items() for cur, v in accd.items()}
        total_by_acc['total'] = ",".join([f"{v.v:6.2f} {cur}" for cur, v in by_cat['spent_total'].items()])

        acc_curs = ['usd_USD','usd_BYN', 'byn_BYN','usd_RUB','byn_RUB','rub_RUB','credit_RUB', 'total']
        headers = ['cat'] + acc_curs
        _sum = [
            ['income'] + [by_acc_cur['income'].get(acc_cur, '') for acc_cur in acc_curs]
        ]
        _sum += [
            [cat] + [accurd.get(acc_cur, '') for acc_cur in acc_curs] \
                for cat, accurd in sorted([(k,v) for k,v in by_acc_cur.items() if k != 'income'], key=lambda kv: kv[0])
        ]
        _sum += [['total'] + [total_by_acc.get(acc_cur, '') for acc_cur in acc_curs]]

        return tabulate(_sum, headers=headers) if printable else (_sum, headers, acc_curs, by_acc_cur)

    def write_summary_to_excel(self, worksheet, by_cat, printable, row_offset=0):

        rows, headers, acc_curs, by_acc_cur = printable

        by_acc_cur_c = {
            cat : {
                f"{acc}_{cur}" : [self.tr_format(tr) for tr in v.trs] \
                    for acc, curd in accd.items() for cur, v in curd.items()
            } for cat, accd in by_cat['summary'].items()
        }

        _com = [
            ['income'] + [by_acc_cur_c['income'].get(acc_cur, None) for acc_cur in acc_curs]
        ]
        _com += [
            [None] + [accurd.get(acc_cur, None) for acc_cur in acc_curs] \
                for cat, accurd in sorted([(k,v) for k,v in by_acc_cur_c.items() if k != 'income'], key=lambda kv: kv[0])
        ]

        for i,h in enumerate(headers):            
            worksheet.write(self.xlsaddr(i,row_offset+0), h)

        for r, (row, row_c) in enumerate(itertools.zip_longest(rows, _com)):
            for c,(v, com) in enumerate(itertools.zip_longest(row, row_c if row_c is not None else [])):
                worksheet.write(self.xlsaddr(c,row_offset+r+1), v)
                if com is not None:
                    worksheet.write_comment(self.xlsaddr(c,row_offset+r+1), str(com))


    def expenses_by_day(self, en):
        ret = defaultdict(list)
        for tr in en:
            ret[tr.date.date()] += [tr]
        return ret

    def printable_speed(self, expenses_by_day, printable=True):

        headers = [''] + [d.day for d in sorted(expenses_by_day.keys())] + ['avg_7']
        all_curs = {tr.currency for d, trs in expenses_by_day.items() for tr in trs}

        def _make_row(_cur):
            by_day_sums = [sum([tr.amount for tr in trs if tr.currency == _cur]) for d,trs in sorted(expenses_by_day.items(), key=lambda kv: kv[0])]
            return [f'by day,{_cur}'] + by_day_sums + [np.mean(by_day_sums[-7:])]
        
        rows = [ _make_row(_cur) for _cur in all_curs] 

        return tabulate(rows, headers=headers) if printable else (rows, headers, all_curs)

    def xlsaddr(self,c,r):
        return str(chr(ord('A')+c))+str(r+1)

    def tr_format(self, tr):
        return f"{tr.account}-{tr.category} {tr.amount:6.2f} {tr.src.category}"

    def write_spd_to_excel(self, worksheet, expenses_by_day, printable):

        rows, headers, all_curs = printable

        def _make_row(_cur):
            return [[self.tr_format(tr) for tr in trs if tr.currency == _cur] for d,trs in sorted(expenses_by_day.items(), key=lambda kv: kv[0])]

        rowsc = [ _make_row(_cur) for _cur in all_curs] 

        for i,h in enumerate(headers):            
            worksheet.write(self.xlsaddr(i,0), h)
        for r, row in enumerate(rows):
            for c,v in enumerate(row):
                worksheet.write(self.xlsaddr(c,r+1), v)
        for r, row in enumerate(rowsc):
            for c,trs in enumerate(row):
                worksheet.write_comment(self.xlsaddr(c+1,r+1), str(trs))
        return len(rows)


    def sterilize(self, obj):
        if isinstance(obj, datetime.datetime):
            return str(obj)
        assert False, str(type(obj))

    def go(self):
        en = self.read_datadir()
        en = self.to_unified_rec(en)
        en = self.filter_by_date(en)
        en = list(en)
        en = sorted(en, key=lambda tr: tr.date)

        with open(self.args.allout, 'w') as f:
            json.dump(en, f, indent=4, default=self.sterilize, ensure_ascii=False)

        en_no_tr = self.filter_transfers(en)
        en_no_tr = list(en_no_tr)

        expenses_by_day = self.expenses_by_day(en_no_tr)
        # expenses_by_day = [(str(d),trs) for d, trs in sorted(expenses_by_day.items(), key=lambda kv: kv[0])]

        # with open(self.args.bydayout, 'w') as f:
        #     json.dump(expenses_by_day, f, indent=4, default=self.sterilize, ensure_ascii=False)

        print(self.printable_speed(expenses_by_day))
        print('\n')

        by_cat = self.group_by_category(en)
        print(self.printable_summary(by_cat))

        workbook = xlsxwriter.Workbook('summary.xlsx')
        worksheet = workbook.add_worksheet()

        row_offset = self.write_spd_to_excel(worksheet, expenses_by_day, 
            self.printable_speed(expenses_by_day, printable=False))
        
        self.write_summary_to_excel(worksheet, by_cat, 
            self.printable_summary(by_cat, printable=False), row_offset=row_offset + 2)
        workbook.close()        

        # with open(self.args.sumout, 'w') as f:
        #     json.dump(en, f, indent=4, default=self.sterilize, ensure_ascii=False)

    @staticmethod
    def main(args):
        logging.basicConfig(level=logging.INFO if not args.debug else logging.DEBUG)
        Main(args).go()

if __name__ == "__main__":
    Main.main(Main.make_parser().parse_args())
